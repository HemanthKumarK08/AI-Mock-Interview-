# MockInterviewAI

**AI-Powered Mock Interview & Performance Analysis System**

## Purpose

MockInterviewAI is an advanced AI-powered mock interview system designed specifically for students and job candidates to practice technical and behavioral interviews, evaluate spoken/coded responses, and receive actionable performance analytics.

## Roles

* **Student / Candidate only** (There is NO Admin role)

## Database

* **Database Name**: `mock_interview_ai`
* **Default Port**: `3306`

## Isolation & Independence

> **Important**: This project is completely independent from IntelliExam AI. IntelliExam is used only as an architectural reference. No IntelliExam files, tables, database, APIs, authentication, documents, uploads, or configuration are modified or reused.

---

## Directory Structure

```text
MockInterviewAI/
├── backend/            # Independent Node.js / Express API
│   ├── config/         # Database and app configurations
│   ├── controllers/    # Route handlers
│   ├── middleware/     # Custom middlewares
│   ├── models/         # Data models
│   ├── routes/         # Express API routes
│   ├── services/       # Business logic services
│   ├── utils/          # Helper utilities
│   └── app.js          # Express app entry point
├── frontend/           # Independent React / Vite application
├── database/           # Independent MySQL schema and migrations
│   ├── schema.sql      # Schema initialization for mock_interview_ai
│   └── migrations/     # Database migration scripts
├── uploads/            # Upload storage (resumes, audio, attachments)
├── reports/            # Generated candidate evaluation reports
├── tests/              # Phase verification and test suites
├── scratch/            # Temporary development workspace
├── docs/               # Project documentation & isolation specs
│   └── PROJECT_ISOLATION.md
├── .env.example        # Clean environment template with placeholders
├── .gitignore          # Repository git ignore rules
├── package.json        # Root package definition
└── README.md           # Project documentation
```

## Running MockInterviewAI

### One-Click Startup (Recommended)

To launch the entire system with automated environment checks, MySQL startup, database table verification, backend, frontend, and browser launch:

```bash
./start_mockinterviewai.command
```

*(On macOS, you can also double-click `start_mockinterviewai.command` in Finder).*

This automatically:
1. Verifies the Node.js / npm environment and `.env` settings.
2. Checks and starts MySQL (via Homebrew if needed).
3. Verifies the `mock_interview_ai` database and all 6 core tables.
4. Starts the backend server and verifies `/api/health`.
5. Starts the React / Vite frontend development server.
6. Automatically opens `http://localhost:5173` in your default browser.
7. Keeps services active and provides graceful cleanup when pressing `Ctrl+C`.

### Additional Launcher Commands

```bash
# Check status of MySQL, database, backend, and frontend
./start_mockinterviewai.command status

# Cleanly stop all running MockInterviewAI background processes
./start_mockinterviewai.command stop
```

---

## Manual Startup

If you prefer starting components individually:

1. Ensure MySQL is running and `mock_interview_ai` is initialized:
   ```bash
   node database/initDb.js
   ```
2. Start backend:
   ```bash
   cd backend && npm run start
   ```
3. Start frontend in another terminal:
   ```bash
   cd frontend && npm run dev
   ```
4. Run all automated test suites:
   ```bash
   node tests/phase6.test.js
   ```
