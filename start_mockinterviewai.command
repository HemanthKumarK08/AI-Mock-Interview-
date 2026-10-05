#!/usr/bin/env zsh
# ==============================================================================
# MockInterviewAI — One-Click Unified Launcher (macOS)
# ==============================================================================
# Project: MockInterviewAI (AI-Powered Adaptive Mock Interview System)
# Location: Dynamically resolved from launcher location
# ==============================================================================

# Resolve project root dynamically (works from any working directory or Finder double-click)
SOURCE="${0}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
PROJECT_ROOT="$(cd -P "$(dirname "$SOURCE")" && pwd)"
cd "$PROJECT_ROOT"

# Text Styling & Colors
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'

# Log Directory & PID Files
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Default Ports
BACKEND_PORT=3000
FRONTEND_PORT=5173

# Track what the launcher started
BACKEND_STARTED_BY_ME=0
FRONTEND_STARTED_BY_ME=0
MYSQL_STARTED_BY_ME=0
BACKEND_PID=""
FRONTEND_PID=""

# Helper: Print Header Banner
print_header() {
  if [ -t 1 ]; then
    clear 2>/dev/null || true
  fi
  echo "${CYAN}${BOLD}"
  echo "================================================================================"
  echo "         MockInterviewAI — AI-Powered Mock Interview System                     "
  echo "================================================================================"
  echo "${RESET}"
}

# Helper: Print Section
print_step() {
  echo " ${BLUE}▸${RESET} ${BOLD}$1${RESET}"
}

print_success() {
  echo "   ${GREEN}✓${RESET} $1"
}

print_warning() {
  echo "   ${YELLOW}⚠${RESET} $1"
}

print_error() {
  echo "   ${RED}✗${RESET} ${BOLD}$1${RESET}"
}

# ------------------------------------------------------------------------------
# CLEAN SHUTDOWN TRAP
# ------------------------------------------------------------------------------
cleanup() {
  # Avoid executing multiple times
  trap - SIGINT SIGTERM EXIT
  echo ""
  echo "${YELLOW}${BOLD}Shutting down MockInterviewAI...${RESET}"

  if [ "$FRONTEND_STARTED_BY_ME" -eq 1 ] && [ -n "$FRONTEND_PID" ]; then
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo " ${DIM}• Stopping frontend (PID $FRONTEND_PID)...${RESET}"
      kill -TERM "$FRONTEND_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$FRONTEND_PID" 2>/dev/null || true
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi

  if [ "$BACKEND_STARTED_BY_ME" -eq 1 ] && [ -n "$BACKEND_PID" ]; then
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo " ${DIM}• Stopping backend (PID $BACKEND_PID)...${RESET}"
      kill -TERM "$BACKEND_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$BACKEND_PID" 2>/dev/null || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi

  # Clean any orphan listeners started by this session
  if [ "$BACKEND_STARTED_BY_ME" -eq 1 ]; then
    local orphan_b=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
    if [ -n "$orphan_b" ]; then
      kill -9 $orphan_b 2>/dev/null || true
    fi
  fi

  if [ "$FRONTEND_STARTED_BY_ME" -eq 1 ]; then
    local orphan_f=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
    if [ -n "$orphan_f" ]; then
      kill -9 $orphan_f 2>/dev/null || true
    fi
  fi

  echo "${GREEN}${BOLD}✓ MockInterviewAI stopped successfully.${RESET}"
  exit 0
}

# ------------------------------------------------------------------------------
# STOP COMMAND HANDLER
# ------------------------------------------------------------------------------
handle_stop() {
  print_header
  echo "${YELLOW}${BOLD}Stopping all MockInterviewAI background services...${RESET}\n"

  local stopped_any=0

  # Check backend PID file
  if [ -f "$BACKEND_PID_FILE" ]; then
    local bpid=$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)
    if [ -n "$bpid" ] && kill -0 "$bpid" 2>/dev/null; then
      echo " ${DIM}• Stopping backend PID $bpid...${RESET}"
      kill -9 "$bpid" 2>/dev/null || true
      stopped_any=1
    fi
    rm -f "$BACKEND_PID_FILE"
  fi

  # Check port 3000
  local port_b_pids=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
  if [ -n "$port_b_pids" ]; then
    echo " ${DIM}• Terminating processes on backend port :$BACKEND_PORT ($port_b_pids)...${RESET}"
    kill -9 $port_b_pids 2>/dev/null || true
    stopped_any=1
  fi

  # Check frontend PID file
  if [ -f "$FRONTEND_PID_FILE" ]; then
    local fpid=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)
    if [ -n "$fpid" ] && kill -0 "$fpid" 2>/dev/null; then
      echo " ${DIM}• Stopping frontend PID $fpid...${RESET}"
      kill -9 "$fpid" 2>/dev/null || true
      stopped_any=1
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi

  # Check port 5173
  local port_f_pids=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
  if [ -n "$port_f_pids" ]; then
    echo " ${DIM}• Terminating processes on frontend port :$FRONTEND_PORT ($port_f_pids)...${RESET}"
    kill -9 $port_f_pids 2>/dev/null || true
    stopped_any=1
  fi

  if [ "$stopped_any" -eq 1 ]; then
    print_success "All MockInterviewAI application processes stopped."
  else
    print_success "No active MockInterviewAI processes found."
  fi
  echo ""
  exit 0
}

# ------------------------------------------------------------------------------
# STATUS COMMAND HANDLER
# ------------------------------------------------------------------------------
handle_status() {
  print_header
  echo "${BOLD}System & Service Status Check:${RESET}\n"

  # MySQL Check
  echo -n "  MySQL Server (localhost:3306): "
  if nc -z localhost 3306 2>/dev/null || lsof -i :3306 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "${GREEN}${BOLD}RUNNING${RESET}"
  else
    echo "${RED}${BOLD}STOPPED${RESET}"
  fi

  # Database Check
  echo -n "  Database (mock_interview_ai):  "
  if node "$PROJECT_ROOT/database/initDb.js" >/dev/null 2>&1; then
    echo "${GREEN}${BOLD}AVAILABLE${RESET}"
  else
    echo "${RED}${BOLD}UNAVAILABLE${RESET}"
  fi

  # Backend Check
  echo -n "  Backend API (port $BACKEND_PORT):      "
  if curl -s -m 2 "http://localhost:$BACKEND_PORT/api/health" | grep -q '"success":true'; then
    echo "${GREEN}${BOLD}HEALTHY (RUNNING)${RESET}"
  else
    echo "${RED}${BOLD}NOT RUNNING${RESET}"
  fi

  # Frontend Check
  echo -n "  Frontend UI (port $FRONTEND_PORT):      "
  if curl -s -m 2 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    echo "${GREEN}${BOLD}AVAILABLE (RUNNING)${RESET}"
  else
    echo "${RED}${BOLD}NOT RUNNING${RESET}"
  fi

  echo ""
  exit 0
}

# Handle arguments
case "$1" in
  stop)
    handle_stop
    ;;
  status)
    handle_status
    ;;
esac

# ------------------------------------------------------------------------------
# MAIN LAUNCHER WORKFLOW
# ------------------------------------------------------------------------------
print_header

# 1. System Requirements Check
print_step "1. Verifying System Prerequisites"

if ! command -v node >/dev/null 2>&1; then
  print_error "Node.js is not installed or not in PATH."
  echo "     Please install Node.js (v18+) from https://nodejs.org or via 'brew install node'."
  exit 1
fi
NODE_VER=$(node -v)
print_success "Node.js environment: ${BOLD}$NODE_VER${RESET}"

if ! command -v npm >/dev/null 2>&1; then
  print_error "npm is not installed or not in PATH."
  exit 1
fi
NPM_VER=$(npm -v)
print_success "npm package manager: ${BOLD}v$NPM_VER${RESET}"

if ! command -v curl >/dev/null 2>&1; then
  print_error "curl command is missing."
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  print_error "lsof utility is missing."
  exit 1
fi

# 2. Project Environment & Configuration Check
print_step "2. Verifying Project Configuration"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  if [ -f "$PROJECT_ROOT/.env.example" ]; then
    print_warning ".env file missing. Creating from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    print_success ".env template created."
  else
    print_error ".env configuration file is missing at $PROJECT_ROOT/.env."
    exit 1
  fi
fi

# Extract configured ports from .env if defined
ENV_PORT=$(grep -E '^PORT=' "$PROJECT_ROOT/.env" | cut -d '=' -f2 | tr -d ' "\r\n' || true)
if [ -n "$ENV_PORT" ]; then
  BACKEND_PORT=$ENV_PORT
fi

print_success "Environment configuration loaded (.env)"
print_success "Target backend port: ${BOLD}$BACKEND_PORT${RESET} | Frontend port: ${BOLD}$FRONTEND_PORT${RESET}"

# 3. Dependencies Verification
print_step "3. Checking Node Dependencies"

if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "   ${YELLOW}• Installing root dependencies...${RESET}"
  (cd "$PROJECT_ROOT" && npm install --silent)
fi

if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
  echo "   ${YELLOW}• Installing backend dependencies...${RESET}"
  (cd "$PROJECT_ROOT/backend" && npm install --silent)
fi

if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
  echo "   ${YELLOW}• Installing frontend dependencies...${RESET}"
  (cd "$PROJECT_ROOT/frontend" && npm install --silent)
fi

print_success "All dependencies verified (root, backend, frontend)"

# 4. MySQL Service Check & Automation
print_step "4. Checking MySQL Server"

is_mysql_running() {
  nc -z localhost 3306 2>/dev/null || lsof -i :3306 -sTCP:LISTEN >/dev/null 2>&1
}

if is_mysql_running; then
  print_success "MySQL service is running (port 3306)"
else
  print_warning "MySQL is not running on port 3306. Attempting automated startup..."

  if command -v brew >/dev/null 2>&1; then
    brew services start mysql >/dev/null 2>&1 || true
    MYSQL_STARTED_BY_ME=1
  elif command -v mysql.server >/dev/null 2>&1; then
    mysql.server start >/dev/null 2>&1 || true
    MYSQL_STARTED_BY_ME=1
  else
    print_error "Homebrew or mysql.server not found to start MySQL automatically."
    echo "     Please start MySQL manually (e.g. 'brew services start mysql') and re-run."
    exit 1
  fi

  # Poll MySQL connection up to 15 seconds
  echo -n "   ${DIM}Waiting for MySQL to accept connections...${RESET}"
  MYSQL_READY=0
  for i in {1..15}; do
    if is_mysql_running; then
      MYSQL_READY=1
      echo ""
      break
    fi
    echo -n "."
    sleep 1
  done

  if [ "$MYSQL_READY" -eq 1 ]; then
    print_success "MySQL service started successfully"
  else
    echo ""
    print_error "MySQL could not be started automatically within 15 seconds."
    echo "     Please verify your MySQL service and start it manually."
    exit 1
  fi
fi

# 5. Database Schema & Tables Verification
print_step "5. Verifying Database Schema (mock_interview_ai)"

DB_INIT_OUT=$(node "$PROJECT_ROOT/database/initDb.js" 2>&1 || true)
if echo "$DB_INIT_OUT" | grep -q '"success":true'; then
  print_success "Database 'mock_interview_ai' and all 6 core tables verified"
else
  print_error "Failed to verify or initialize database 'mock_interview_ai'."
  echo "     Details: $DB_INIT_OUT"
  exit 1
fi

# 6. Backend Service Startup & Health Check
print_step "6. Starting Backend Server"

# Check if Backend is already running and healthy
if curl -s -m 2 "http://localhost:$BACKEND_PORT/api/health" | grep -q '"success":true'; then
  print_success "Backend is already running and healthy on port ${BOLD}$BACKEND_PORT${RESET} (reusing instance)"
  BACKEND_STARTED_BY_ME=0
else
  # Check if port is occupied by an unknown process
  EXISTING_BACKEND_OCCUPIER=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
  if [ -n "$EXISTING_BACKEND_OCCUPIER" ]; then
    print_error "Port $BACKEND_PORT is occupied by an unverified process (PID $EXISTING_BACKEND_OCCUPIER)."
    echo "     Please free port $BACKEND_PORT or run './start_mockinterviewai.command stop' first."
    exit 1
  fi

  echo "   ${DIM}• Launching backend process...${RESET}"
  (cd "$PROJECT_ROOT/backend" && exec node app.js) > "$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
  BACKEND_STARTED_BY_ME=1

  # Poll health check up to 25 seconds
  echo -n "   ${DIM}Waiting for backend health check (${BACKEND_PORT})...${RESET}"
  BACKEND_HEALTHY=0
  for i in {1..25}; do
    if curl -s -m 2 "http://localhost:$BACKEND_PORT/api/health" | grep -q '"success":true'; then
      BACKEND_HEALTHY=1
      echo ""
      break
    fi
    # If process died prematurely, fail immediately
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo ""
      print_error "Backend process died unexpectedly during startup."
      echo "${RED}Backend Log snippet (${BACKEND_LOG}):${RESET}"
      tail -n 15 "$BACKEND_LOG"
      exit 1
    fi
    echo -n "."
    sleep 1
  done

  if [ "$BACKEND_HEALTHY" -eq 1 ]; then
    print_success "Backend is healthy (http://localhost:$BACKEND_PORT/api/health)"
  else
    echo ""
    print_error "Backend did not become healthy within 25 seconds."
    echo "${RED}Backend Log snippet (${BACKEND_LOG}):${RESET}"
    tail -n 20 "$BACKEND_LOG"
    exit 1
  fi
fi

# 7. Frontend Service Startup & Verification
print_step "7. Starting Frontend Studio (React / Vite)"

if curl -s -m 2 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
  print_success "Frontend is already running on port ${BOLD}$FRONTEND_PORT${RESET} (reusing instance)"
  FRONTEND_STARTED_BY_ME=0
else
  EXISTING_FRONTEND_OCCUPIER=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
  if [ -n "$EXISTING_FRONTEND_OCCUPIER" ]; then
    print_warning "Port $FRONTEND_PORT is occupied (PID $EXISTING_FRONTEND_OCCUPIER). Checking responsiveness..."
  fi

  echo "   ${DIM}• Launching Vite dev server...${RESET}"
  (cd "$PROJECT_ROOT/frontend" && exec npm run dev -- --host localhost --port $FRONTEND_PORT) > "$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
  FRONTEND_STARTED_BY_ME=1

  # Poll frontend up to 25 seconds
  echo -n "   ${DIM}Waiting for frontend readiness (${FRONTEND_PORT})...${RESET}"
  FRONTEND_READY=0
  for i in {1..25}; do
    if curl -s -m 2 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
      FRONTEND_READY=1
      echo ""
      break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo ""
      print_error "Frontend process died unexpectedly during startup."
      echo "${RED}Frontend Log snippet (${FRONTEND_LOG}):${RESET}"
      tail -n 15 "$FRONTEND_LOG"
      exit 1
    fi
    echo -n "."
    sleep 1
  done

  if [ "$FRONTEND_READY" -eq 1 ]; then
    print_success "Frontend is ready (http://localhost:$FRONTEND_PORT)"
  else
    echo ""
    print_error "Frontend did not respond within 25 seconds."
    echo "${RED}Frontend Log snippet (${FRONTEND_LOG}):${RESET}"
    tail -n 20 "$FRONTEND_LOG"
    exit 1
  fi
fi

# 8. Open in Default Browser
print_step "8. Launching Application in Browser"
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$FRONTEND_PORT"
  print_success "Opened http://localhost:$FRONTEND_PORT in default browser"
else
  print_warning "Could not invoke 'open'. Navigate manually to: http://localhost:$FRONTEND_PORT"
fi

# 9. Ready Banner & Interactive Loop
# Register trap for clean shutdown
trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "${GREEN}${BOLD}================================================================================${RESET}"
echo "${GREEN}${BOLD}                       MockInterviewAI is LIVE & READY!                         ${RESET}"
echo "${GREEN}${BOLD}================================================================================${RESET}"
echo ""
echo "   ${BOLD}Frontend Application:${RESET} ${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo "   ${BOLD}Backend API Service:${RESET}  ${CYAN}http://localhost:$BACKEND_PORT${RESET}"
echo "   ${BOLD}API Health Check:${RESET}     ${CYAN}http://localhost:$BACKEND_PORT/api/health${RESET}"
echo "   ${BOLD}Logs Directory:${RESET}       ${DIM}$LOG_DIR${RESET}"
echo ""
echo " ${DIM}──────────────────────────────────────────────────────────────────────────────${RESET}"
echo "  ${YELLOW}${BOLD}Press [Ctrl + C] in this terminal at any time to cleanly stop all services.${RESET}"
echo " ${DIM}──────────────────────────────────────────────────────────────────────────────${RESET}"
echo ""

# Keep launcher alive and monitor processes
while true; do
  # Check if backend crashed
  if [ "$BACKEND_STARTED_BY_ME" -eq 1 ] && [ -n "$BACKEND_PID" ]; then
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo ""
      print_error "Backend process (PID $BACKEND_PID) exited unexpectedly."
      exit 1
    fi
  fi

  # Check if frontend crashed
  if [ "$FRONTEND_STARTED_BY_ME" -eq 1 ] && [ -n "$FRONTEND_PID" ]; then
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo ""
      print_error "Frontend process (PID $FRONTEND_PID) exited unexpectedly."
      exit 1
    fi
  fi

  sleep 2
done
