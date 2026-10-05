# MockInterviewAI

**AI-Powered Adaptive Mock Interview & Candidate Performance Analysis System**

---

## Overview

MockInterviewAI is an advanced AI-powered mock interview and performance analysis platform designed for students and job candidates. It conducts dynamic, multi-turn technical and behavioral interviews through interactive voice or text, assesses candidate answers using evidence-based scoring rubrics, adapts interview depth based on candidate responses, and provides comprehensive performance reports.

---

## Core Capabilities

- **Authentication & Candidate Profiles**: Secure JWT-based authentication, student profiles, and session management.
- **Interview Setup & Customization**: Support for diverse target roles (Full Stack, Backend, Frontend, Data Analyst, Java Developer, etc.), interview types (Technical, Behavioral, HR), and difficulty levels.
- **AI Interview Orchestration**: Multi-turn conversational interview state machine with question grounding and quality validation.
- **Evidence-Based Answer Evaluation**: Intent-aware evaluation distinguishing honest uncertainty, partial explanations, concise correct definitions, factual errors, and strong architectural answers.
- **Continuous Voice Interview**: Real-time microphone capture, silence detection, Speech-to-Text (STT), natural Text-to-Speech (TTS), and audio transcript integrity.
- **Conversational Reasoning & Topic Tracking**: Dynamic story thread tracking, curiosity-driven probing, supportive pivots on candidate uncertainty, and candidate-owned topic following.
- **Performance Reporting & Analytics**: Detailed scorecards across Technical Accuracy, Relevance, Completeness, Clarity, and Communication with actionable strengths and improvements.

---

## Roles

* **Student / Candidate** (Dedicated single-role architecture; no administrative overhead)

---

## Database Architecture

* **Database**: `mock_interview_ai`
* **Default Port**: `3306`
* **Tables**: `users`, `user_sessions`, `candidate_profiles`, `interview_sessions`, `interview_conversations`, `answer_evaluations`

---

## Isolation & Independence

> **Important**: This project is completely independent from external systems. IntelliExam is used only as a reference model. No external files, tables, database instances, APIs, authentication credentials, or uploads are modified or reused.

---

## Directory Structure

```text
MockInterviewAI/
├── backend/            # Express API, AI services, evaluation & reasoning engines
│   ├── config/         # Database and app configurations
│   ├── controllers/    # Route handlers
│   ├── middleware/     # Auth, rate limiting & error middlewares
│   ├── models/         # Data models
│   ├── routes/         # Express API routes
│   ├── services/       # Business logic services (AI, speech, reasoning, evaluation)
│   ├── utils/          # Security, JWT, token & prompt utilities
│   └── app.js          # Express application entry point
├── frontend/           # React + Vite single-page application
│   ├── src/            # Components, pages, hooks, contexts, audio utilities
│   ├── index.html      # Frontend HTML entry point
│   └── vite.config.js  # Vite bundler configuration
├── database/           # MySQL schema and initialization scripts
│   ├── schema.sql      # Schema initialization for mock_interview_ai
│   └── initDb.js       # Database connection & table bootstrapper
├── tests/              # Functional verification and test suites
│   ├── foundation.test.js
│   ├── authentication.test.js
│   ├── interviewSession.test.js
│   ├── aiInterviewOrchestration.test.js
│   ├── answerEvaluation.test.js
│   ├── voiceInterview.test.js
│   ├── interviewReporting.test.js
│   ├── voiceSettings.test.js
│   ├── conversationIntelligence.test.js
│   ├── conversationalReasoning.test.js
│   ├── continuousVoice.test.js
│   ├── currentAnswerReasoning.test.js
│   ├── conversationFlow.test.js
│   ├── transcriptIntegrity.test.js
│   └── evaluationIntegrity.test.js
├── docs/               # Architecture, reasoning, and test documentation
├── uploads/            # Local storage for audio and attachments
├── package.json        # Root package definition & test runners
└── README.md           # Project documentation
```

---

## Getting Started

### One-Click Startup (Recommended for macOS)

To launch the complete system with automated environment checks, MySQL startup, database table verification, backend, frontend, and browser launch:

```bash
./start_mockinterviewai.command
```

*(On macOS, you can also double-click `start_mockinterviewai.command` in Finder).*

#### Additional Launcher Controls:
```bash
# Check status of MySQL, database, backend, and frontend
./start_mockinterviewai.command status

# Cleanly stop all running MockInterviewAI background processes
./start_mockinterviewai.command stop
```

---

### Manual Startup

If you prefer starting components manually:

1. **Initialize Database**:
   ```bash
   node database/initDb.js
   ```

2. **Start Backend Server**:
   ```bash
   cd backend && npm run start
   ```

3. **Start Frontend Development Server**:
   ```bash
   cd frontend && npm run dev
   ```

---

## Running Automated Tests

Run the complete functional verification test suite:

```bash
npm test
```

### Specialized Test Suites:

```bash
# Foundation & Database Isolation
npm run test:foundation

# Authentication & Session Security
npm run test:auth

# Interview Setup & State Management
npm run test:session

# AI Question Generation & Orchestration
npm run test:orchestration

# Answer Evaluation & Scoring
npm run test:evaluation

# Voice Interview (STT & TTS)
npm run test:voice

# Interview Reports & Scorecards
npm run test:reporting

# Voice Settings & Conversational Audio
npm run test:settings

# Adaptive Intelligence & Memory
npm run test:intelligence

# Conversational Reasoning & Story Tracking
npm run test:reasoning

# Evaluation Integrity (Negative/Uncertainty Scoring)
npm run test:evaluation-integrity

# Transcript & STT Audio Integrity
npm run test:transcript-integrity
```
