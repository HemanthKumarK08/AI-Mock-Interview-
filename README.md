<div align="center">

# 🎤 MockInterviewAI

### AI-Powered Adaptive Mock Interview & Candidate Performance Analysis System

[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![AI](https://img.shields.io/badge/AI-Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-481%2F481%20Passing-success)](#-testing)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#-license)

</div>

> **MockInterviewAI** is an AI-powered adaptive mock interview platform that simulates realistic technical, behavioral, and HR interviews through text and continuous voice interaction. It understands candidate responses, follows relevant conversation threads, evaluates answers using evidence-based scoring, and generates detailed performance insights.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Database Architecture](#-database-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Testing](#-testing)
- [Quality & Verification](#-quality--verification)
- [Project Isolation](#-project-isolation)
- [Documentation](#-documentation)
- [Interview Processing Flow](#-interview-processing-flow)
- [Design Principles](#-design-principles)
- [Browser & Voice Considerations](#-browser--voice-considerations)
- [Future Enhancements](#-future-enhancements)
- [Project Information](#-project-information)
- [License](#-license)

---

## 📌 Overview

Traditional mock interview systems usually follow a fixed sequence of questions. They ask a question, receive an answer, and move to another predefined question without understanding the candidate's actual response.

**MockInterviewAI** behaves differently. It analyzes what the candidate actually says and dynamically decides what should happen next.

**Example**

```text
Candidate:
"The hardest part of my project was the voice interview."

                ↓

AI understands:
  • Candidate introduced a challenge
  • Topic = Voice Interview
  • Opportunity = Explore the challenge

                ↓

AI:
"What specifically made the voice interaction difficult?"

                ↓

Candidate:
"Sometimes the system stopped listening too early."

                ↓

AI:
"How did you determine when the candidate had finished speaking?"
```

The interviewer follows the candidate's story instead of simply moving through a fixed questionnaire.

---

## ✨ Key Features

### 🤖 Adaptive AI Interviewer

- Dynamic multi-turn interview orchestration
- Technical, behavioral, HR, and mixed interview modes
- Role-specific interview configuration
- Difficulty-based questioning
- Adaptive follow-up questions
- Context-aware question generation
- Question grounding and quality validation
- Duplicate question prevention
- Controlled topic transitions

### 🧠 Context-Aware Conversational Reasoning

MockInterviewAI maintains conversational context throughout the interview. It tracks:

- Active conversation topics and story threads
- Candidate claims
- Technologies mentioned and projects discussed
- Decisions, challenges, actions, and results
- Unresolved details and contradictions
- Candidate strengths and weak areas
- Topic depth and previous question intent

The system prioritizes the candidate's **latest answer** when deciding what to ask next.

**Example**

```text
Candidate: "I built a mock interview system using React and Node.js."
AI:        "What part of the system was the most challenging to build?"

Candidate: "The voice interview was the hardest part."
AI:        "What specifically made the voice interaction difficult?"

Candidate: "Sometimes silence detection stopped recording too early."
AI:        "How did you decide how much silence was enough before ending the recording?"
```

### 🎙️ Continuous Voice Interview

MockInterviewAI supports a fully automated voice interview experience.

```text
AI asks question
       ↓
AI speaks using TTS
       ↓
AI speech ends
       ↓
Microphone automatically activates
       ↓
Candidate speaks
       ↓
Speech Recognition captures transcript
       ↓
Silence detection identifies completion
       ↓
Answer is evaluated
       ↓
AI generates contextual follow-up
       ↓
AI speaks next question
       ↓
Loop continues
```

**Voice capabilities**

- Browser microphone capture and native Speech Recognition
- Speech-to-Text (STT) and Text-to-Speech (TTS)
- Voice activity detection and silence-based answer completion
- Transcript preview
- Automatic listening and automatic next-question flow
- AI speech / microphone lifecycle separation
- Audio feedback prevention
- Voice turn isolation
- Stale transcript protection
- Transcript integrity validation

> 🔒 Raw candidate audio is **not** stored permanently in the MySQL database.

### 🔊 Natural Voice Interaction

- Voice selection and presets
- Speaking rate, pitch, and volume controls
- Voice preview and speech preparation
- Sequential TTS queue
- Pause / resume support
- Replay functionality
- Speech lifecycle management

```text
AI Speaking → Listening → Candidate Speaking → Processing → AI Thinking → AI Speaking
```

The microphone remains inactive while the AI is speaking to prevent acoustic feedback.

### 📝 Evidence-Based Answer Evaluation

Candidate answers are evaluated across multiple dimensions:

| Dimension | Description |
| --- | --- |
| **Technical Accuracy** | Correctness of demonstrated technical knowledge |
| **Relevance** | How directly the answer addresses the question |
| **Completeness** | Whether important aspects of the question were covered |
| **Clarity** | How clearly the answer was communicated |
| **Communication** | Quality of verbal / written communication |

The evaluator **does not award points for knowledge the candidate did not demonstrate.**

| Question | Answer | Result |
| --- | --- | --- |
| "What is SQL?" | "Structured Query Language." | High technical accuracy, high relevance, appropriate completeness |
| "What is SQL?" | "I don't know." | Low technical knowledge, low completeness, reasonable clarity if clearly communicated |

### 🎯 Intent-Aware Evaluation

The evaluation engine distinguishes between different answer types, including:

`Uncertainty` · `Knowledge gaps` · `Non-implementation` · `Incorrect answers` · `Off-topic answers` · `Partial answers` · `Direct answers` · `Technical details` · `Strong answers` · `Behavioral responses` · `Challenges` · `Decisions` · `Results`

This prevents generic scoring behavior. For example, `"I don't know."` is **not** treated as a *partially correct technical answer* — the system recognizes that the candidate did not demonstrate knowledge of the requested concept.

### 🔄 Human-Like Adaptive Follow-Ups

The interviewer can follow several conversational strategies:

`CLARIFICATION` · `DEEP DIVE` · `WHY` · `DECISION` · `CHALLENGE` · `TRADE-OFF` · `TRANSITION` · `NEW TOPIC` · `SUPPORTIVE PIVOT`

**Example**

```text
Candidate: "We selected MySQL."
AI:        "What made MySQL a good fit for your project?"

Candidate: "Our data was highly relational."
AI:        "How did that relational structure influence your database design?"
```

The next question is always grounded in what the candidate actually said.

### 🛡️ Answer & Transcript Integrity

Safeguards against fabricated or stale candidate responses:

- No synthetic candidate transcripts
- Empty STT results are rejected
- Failed transcription does not fabricate an answer
- Candidate is asked to repeat unclear responses
- Transcript state is cleared between turns
- Monotonic voice turn IDs prevent stale async results
- AI microphone feedback is prevented
- Voice and text answers use the same conversational pipeline
- Current candidate answer has priority over stale conversation context

### 📊 Interview Performance Reports

After completing an interview, the system generates a detailed report containing:

- Overall performance score
- Technical performance, relevance, completeness, clarity, and communication scores
- Strengths and weaknesses
- Improvement recommendations
- Answer-level evaluations
- Interview history and performance analytics

Reports are generated from the persisted interview conversation and evaluation data.

### 🔐 Authentication & Security

- JWT-based authentication
- bcrypt password hashing
- Database-backed sessions and session ownership validation
- Protected API routes and role-aware authorization
- Rate limiting and CORS protection
- SQL injection protection and input validation
- Secure session handling
- Cross-user resource protection

Users can only access their **own** interview sessions, conversations, evaluations, and reports.

### 👤 Candidate Profile

Candidates can maintain an interview profile containing relevant career information, used as context during interview generation and evaluation.

### 🎛️ Interview Configuration

| Setting | Options |
| --- | --- |
| **Target role** | Full Stack Developer, Backend Developer, Frontend Developer, Java Developer, Data Analyst, and more |
| **Interview type** | Technical · Behavioral · HR · Mixed |
| **Difficulty** | Beginner · Intermediate · Advanced |
| **Mode** | Text · Voice |
| **Question count** | 5 · 10 · 15 · 20 |
| **Duration** | 15 · 30 · 45 · 60 minutes |

---

## 🏗️ System Architecture

```text
                    ┌───────────────────────┐
                    │       React UI        │
                    │     + Vite Frontend   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Express REST API    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        Authentication    Interview Engine    Voice Services
              │                 │                 │
              │                 │          ┌──────┴──────┐
              │                 │          │             │
              │                 │         STT           TTS
              │                 │
              │                 ▼
              │        Conversation Engine
              │                 │
              │        ┌────────┼────────┐
              │        │        │        │
              │        ▼        ▼        ▼
              │     Answer    Memory   Reasoning
              │  Understanding  │        │
              │        │        │        │
              │        └────────┼────────┘
              │                 ▼
              │         Question Strategy
              │                 │
              │                 ▼
              │         Question Quality
              │                 │
              │                 ▼
              │          AI / Fallback
              │
              └─────────────────┬─────────────────
                                │
                                ▼
                       ┌─────────────────┐
                       │      MySQL      │
                       │ mock_interview_ai│
                       └─────────────────┘
```

---

## 🗄️ Database Architecture

**Database:** `mock_interview_ai` &nbsp;•&nbsp; **Default MySQL port:** `3306`

**Tables:** `users`, `user_sessions`, `candidate_profiles`, `interview_sessions`, `interview_conversations`, `answer_evaluations`

```text
users
  │
  ├── user_sessions
  │
  ├── candidate_profiles
  │
  └── interview_sessions
           │
           └── interview_conversations
                    │
                    └── answer_evaluations
```

---

## 🧰 Technology Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React, Vite, JavaScript, Web Speech API, Web Audio API, Browser Media APIs, CSS |
| **Backend** | Node.js, Express.js, REST APIs, JWT, bcrypt, Multer, MySQL driver |
| **AI** | Google Gemini, AI provider abstraction, deterministic contextual fallback, prompt engineering, structured answer understanding, conversational reasoning |
| **Voice** | Browser Speech Recognition, STT, TTS, Web Audio API, Voice Activity Detection, silence detection, TTS queue management |
| **Database** | MySQL, relational data model, foreign keys, indexed interview/session data, JSON metadata where appropriate |
| **Testing** | Node.js test suites — functional, integration, regression, voice integrity, conversation reasoning, evaluation integrity |

---

## 📁 Project Structure

```text
MockInterviewAI/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   │   ├── ai/
│   │   ├── conversation/
│   │   ├── speech/
│   │   ├── tts/
│   │   └── evaluation/
│   ├── utils/
│   └── app.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── contexts/
│   ├── index.html
│   └── vite.config.js
│
├── database/
│   ├── schema.sql
│   └── initDb.js
│
├── tests/
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
│
│
├── uploads/
├── package.json
├── README.md
└── start_mockinterviewai.command
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- MySQL
- A modern Chromium-based browser or Safari
- Git

> 🎙️ For voice interviews, microphone access must be allowed by the browser.

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd MockInterviewAI
```

### 2. Install dependencies

```bash
# Root
npm install

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 3. Configure environment variables

Create the required `.env` files. Typical configuration:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=mock_interview_ai

JWT_SECRET=your_secure_jwt_secret

GEMINI_API_KEY=your_gemini_api_key
```

> ⚠️ **Never** commit real API keys, passwords, JWT secrets, or other credentials to GitHub.

### 🖥️ One-Click Startup (macOS)

```bash
./start_mockinterviewai.command
```

The launcher handles MySQL availability, database verification, backend/frontend startup, health checks, browser launch, running-process detection, and clean shutdown.

```bash
# Check current system status
./start_mockinterviewai.command status

# Stop all MockInterviewAI processes
./start_mockinterviewai.command stop
```

On macOS, the launcher can also be opened directly from Finder.

### 🔧 Manual Startup

```bash
# 1. Initialize the database
node database/initDb.js

# 2. Start the backend
cd backend
npm run start
```

In a second terminal:

```bash
# 3. Start the frontend
cd frontend
npm run dev
```

Then open the URL displayed by Vite.

---

## 🧪 Testing

MockInterviewAI includes a comprehensive functional verification suite.

```bash
npm test
```

**Current status: `481 / 481` tests passing ✅**

| Area | Test Suite | Status |
| --- | --- | :---: |
| Foundation & Database Isolation | `foundation.test.js` | 15/15 |
| Authentication & Candidate Profiles | `authentication.test.js` | 34/34 |
| Interview Sessions | `interviewSession.test.js` | 40/40 |
| AI Interview Orchestration | `aiInterviewOrchestration.test.js` | 40/40 |
| Answer Evaluation & Scoring | `answerEvaluation.test.js` | 41/41 |
| Voice Interview | `voiceInterview.test.js` | 43/43 |
| Interview Reporting | `interviewReporting.test.js` | 33/33 |
| Voice Settings | `voiceSettings.test.js` | 42/42 |
| Conversation Intelligence | `conversationIntelligence.test.js` | 33/33 |
| Conversational Reasoning | `conversationalReasoning.test.js` | 40/40 |
| Continuous Voice | `continuousVoice.test.js` | 2/2 |
| Current Answer Reasoning | `currentAnswerReasoning.test.js` | 25/25 |
| Conversation Flow | `conversationFlow.test.js` | 20/20 |
| Transcript Integrity | `transcriptIntegrity.test.js` | 20/20 |
| Evaluation Integrity | `evaluationIntegrity.test.js` | 20/20 |
| **Total** | **15 suites** | **481/481** |

<details>
<summary><b>Specialized test commands</b></summary>

```bash
npm run test:foundation
npm run test:auth
npm run test:session
npm run test:orchestration
npm run test:evaluation
npm run test:voice
npm run test:reporting
npm run test:settings
npm run test:intelligence
npm run test:reasoning
npm run test:continuous-voice
npm run test:answer-reasoning
npm run test:conversation-flow
npm run test:transcript-integrity
npm run test:evaluation-integrity
```

</details>

---

## 📈 Quality & Verification

| Area | Status |
| --- | :---: |
| Authentication | ✅ |
| Interview lifecycle | ✅ |
| AI orchestration | ✅ |
| Adaptive follow-ups | ✅ |
| Conversational memory | ✅ |
| Story tracking | ✅ |
| Contextual reasoning | ✅ |
| Question quality | ✅ |
| Voice interaction | ✅ |
| Speech recognition integrity | ✅ |
| TTS lifecycle | ✅ |
| Answer evaluation | ✅ |
| Scoring integrity | ✅ |
| Interview reporting | ✅ |
| Security | ✅ |
| Text/Voice parity | ✅ |

---

## 🔒 Project Isolation

MockInterviewAI is a completely independent project with its own database, API, authentication, sessions, tables, configuration, uploads, dependencies, and test suites.

**IntelliExam isolation** — IntelliExam was used only as a conceptual/reference architecture and was kept read-only:

| Metric | Count |
| --- | :---: |
| IntelliExam source modifications | 0 |
| IntelliExam database modifications | 0 |
| IntelliExam credentials reused | 0 |
| IntelliExam uploads modified | 0 |

MockInterviewAI does not depend on IntelliExam at runtime.

---

## 📚 Documentation

Detailed technical documentation lives in the [`docs/`](./docs) directory:

| Topic | File |
| --- | --- |
| Architecture | [`docs/architecture.md`](./docs/architecture.md) |
| Authentication | [`docs/authentication.md`](./docs/authentication.md) |
| Interview Sessions | [`docs/interview-session.md`](./docs/interview-session.md) |
| AI Orchestration | [`docs/ai-orchestration.md`](./docs/ai-orchestration.md) |
| Answer Evaluation | [`docs/answer-evaluation.md`](./docs/answer-evaluation.md) |
| Voice Interview | [`docs/voice-interview.md`](./docs/voice-interview.md) |
| Interview Reporting | [`docs/interview-reporting.md`](./docs/interview-reporting.md) |
| Voice Settings | [`docs/voice-settings.md`](./docs/voice-settings.md) |
| Conversation Intelligence | [`docs/conversation-intelligence.md`](./docs/conversation-intelligence.md) |
| Conversational Reasoning | [`docs/conversational-reasoning.md`](./docs/conversational-reasoning.md) |
| Transcript Integrity | [`docs/transcript-integrity.md`](./docs/transcript-integrity.md) |
| Evaluation Integrity | [`docs/evaluation-integrity.md`](./docs/evaluation-integrity.md) |
| Live Conversation Flow | [`docs/live-conversation-flow.md`](./docs/live-conversation-flow.md) |

---

## 🧭 Interview Processing Flow

```text
Create Interview
      ↓
Configure Role / Type / Difficulty / Mode
      ↓
Start Interview
      ↓
AI Generates Question
      ↓
AI Speaks / Displays Question
      ↓
Candidate Answers
      ↓
Speech Recognition / Text Input
      ↓
Answer Understanding
      ↓
Answer Evaluation
      ↓
Conversation Memory Update
      ↓
Story Thread Update
      ↓
Interviewer Reasoning
      ↓
Adaptive Strategy Selection
      ↓
Contextual Follow-Up
      ↓
Question Quality Gate
      ↓
Next Question  ──►  (repeat)
      ↓
Interview Completion
      ↓
Performance Report
      ↓
Analytics & Feedback
```

---

## 🎯 Design Principles

1. **Candidate Answer First** — The latest candidate response is the primary conversational signal.
2. **Follow the Candidate's Story** — Explore meaningful details introduced by the candidate.
3. **Evidence-Based Evaluation** — Scores are based on what the candidate actually demonstrated.
4. **Honest Uncertainty** — "I don't know" is a knowledge gap, not fabricated partial knowledge.
5. **Contextual Follow-Ups** — Questions stay connected to the current conversation.
6. **Natural Topic Transitions** — Move on when a thread has been sufficiently explored.
7. **Voice/Text Consistency** — Both modes share the same conversational and evaluation logic.
8. **Deterministic Fallbacks** — If the AI service is unavailable, grounded fallback behavior is used rather than fabricating candidate information.
9. **Security & Isolation** — Candidate data and interview sessions remain isolated and protected.

---

## ⚠️ Browser & Voice Considerations

Voice functionality depends on browser support for microphone access, Speech Recognition, Web Audio APIs, and Text-to-Speech. The browser must have permission to access the microphone.

Recognition quality may vary depending on browser, operating system, microphone quality, background noise, network conditions, and the speech recognition implementation.

> Text interview mode remains available when voice capabilities are unavailable.

---

## 🔮 Future Enhancements

- [ ] Neural-quality cloud TTS providers
- [ ] Additional language support
- [ ] More specialized interview roles
- [ ] Resume-aware interview generation
- [ ] Job-description-aware interviews
- [ ] Interview difficulty calibration
- [ ] Advanced behavioral analysis
- [ ] Skill-gap visualization
- [ ] Personalized preparation plans
- [ ] Interview trend analysis across multiple sessions
- [ ] More advanced speech analytics

---

## 👨‍💻 Project Information

| | |
| --- | --- |
| **Project** | MockInterviewAI |
| **Full title** | AI-Powered Adaptive Mock Interview & Candidate Performance Analysis System |
| **Application type** | AI-powered web application |
| **Primary user** | Student / Job Candidate |
| **Database** | MySQL |
| **Frontend** | React + Vite |
| **Backend** | Node.js + Express |
| **AI** | Google Gemini + deterministic fallback |
| **Voice** | Browser Speech Recognition + Web Audio + TTS |

---


## ⭐ Project Summary

MockInterviewAI combines **Artificial Intelligence + Conversational Reasoning + Continuous Voice Interaction + Evidence-Based Evaluation + Adaptive Questioning + Performance Analytics** to create a more realistic and useful mock interview experience for students and job candidates.

Unlike a traditional question bank, it attempts to understand what the candidate actually said, determine what is worth exploring next, evaluate what the candidate actually demonstrated, and provide actionable feedback for improvement.
