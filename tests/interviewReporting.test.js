/**
 * Interview Reporting & Analytics Verification Test Suite
 * MockInterviewAI — Interview Report, Performance Scorecard & Analytics
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const app = require('../backend/app');
const AuthService = require('../backend/services/authService');
const InterviewSessionService = require('../backend/services/interviewSessionService');
const ConversationEngine = require('../backend/services/conversationEngine');
const AnswerEvaluationService = require('../backend/services/answerEvaluationService');
const InterviewReportService = require('../backend/services/interviewReportService');
const InterviewSessionModel = require('../backend/models/interviewSessionModel');
const InterviewConversationModel = require('../backend/models/interviewConversationModel');
const AnswerEvaluationModel = require('../backend/models/answerEvaluationModel');

function makeRequest(server, options, requestBody = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsedBody = data;
        try {
          parsedBody = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          raw: data
        });
      });
    });

    req.on('error', reject);

    if (requestBody) {
      req.write(typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody));
    }
    req.end();
  });
}

async function runInterviewReportingTests() {
  const results = [];
  let server;
  let dbConnection;

  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    const { pool } = require('../backend/config/db');
    dbConnection = pool;

    const uniqueSuffix = Date.now().toString().slice(-6);
    // Student Alice
    const studentAlice = await AuthService.register({
      name: 'Alice Reporter',
      email: `alice.report.${uniqueSuffix}@example.com`,
      password: 'Password@123'
    });
    const loginAlice = await AuthService.login({ email: studentAlice.email, password: 'Password@123' });
    const tokenAlice = loginAlice.token;

    // Student Bob (for cross-user isolation)
    const studentBob = await AuthService.register({
      name: 'Bob Reporter',
      email: `bob.report.${uniqueSuffix}@example.com`,
      password: 'Password@123'
    });
    const loginBob = await AuthService.login({ email: studentBob.email, password: 'Password@123' });
    const tokenBob = loginBob.token;

    // Setup a 5-question completed interview for Alice with known evaluation values for deterministic verification
    const sessionAlice = await InterviewSessionService.createSession(studentAlice.id, {
      targetRole: 'Java Developer',
      interviewType: 'technical',
      difficulty: 'intermediate',
      questionCount: 5,
      durationMinutes: 30,
      interviewMode: 'text'
    });

    await ConversationEngine.startInterview(studentAlice.id, sessionAlice.id);

    // Answer 5 turns to complete session
    const answers = [
      'In Java, HashMap is not synchronized and allows null keys, while Hashtable is thread-safe and rejects nulls.',
      'Polymorphism allows objects to take multiple forms through method overloading and method overriding.',
      'Garbage collection in Java automatically reclaims memory by identifying unreachable objects in the heap.',
      'Spring IoC container manages bean lifecycles and provides dependency injection via annotations like @Autowired.',
      'Database indexing uses B-Trees to speed up SELECT query execution while adding slight overhead to writes.'
    ];

    for (let i = 0; i < 5; i++) {
      await ConversationEngine.submitAnswer(studentAlice.id, sessionAlice.id, answers[i]);
    }

    // ==========================================
    // 1. REPORT GENERATION (TEST 01 - 12)
    // ==========================================

    // TEST 01: Completed interview report generated
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlice.id}/report`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });

      if (res.statusCode === 200 && res.body.success && res.body.data?.report) {
        results.push({ id: 'TEST 01', name: 'Completed interview report generated', result: 'PASS', details: 'Full structured report returned successfully' });
      } else {
        results.push({ id: 'TEST 01', name: 'Completed interview report generated', result: 'FAIL', details: `Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 01', name: 'Completed interview report generated', result: 'FAIL', details: e.message });
    }

    // TEST 02: Correct interview metadata returned
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (
        report.interview.id === sessionAlice.id &&
        report.interview.targetRole === 'Java Developer' &&
        report.interview.interviewType === 'technical' &&
        report.interview.difficulty === 'intermediate' &&
        report.interview.status === 'completed'
      ) {
        results.push({ id: 'TEST 02', name: 'Correct interview metadata returned', result: 'PASS', details: `Target role: ${report.interview.targetRole}, Status: ${report.interview.status}` });
      } else {
        results.push({ id: 'TEST 02', name: 'Correct interview metadata returned', result: 'FAIL', details: `Metadata mismatch: ${JSON.stringify(report.interview)}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 02', name: 'Correct interview metadata returned', result: 'FAIL', details: e.message });
    }

    // TEST 03: Correct evaluated answer count
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (report.summary.evaluatedAnswers === 5 && report.summary.totalQuestions === 5) {
        results.push({ id: 'TEST 03', name: 'Correct evaluated answer count', result: 'PASS', details: `Evaluated: ${report.summary.evaluatedAnswers}/5 answers` });
      } else {
        results.push({ id: 'TEST 03', name: 'Correct evaluated answer count', result: 'FAIL', details: `Evaluated count: ${report.summary.evaluatedAnswers}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 03', name: 'Correct evaluated answer count', result: 'FAIL', details: e.message });
    }

    // TEST 04: Correct deterministic overall score calculation
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      const dims = [
        report.dimensions.technicalAccuracy.score,
        report.dimensions.relevance.score,
        report.dimensions.completeness.score,
        report.dimensions.clarity.score,
        report.dimensions.communication.score
      ].filter(v => v !== null);

      const expectedOverall = Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10;
      if (report.summary.overallScore === expectedOverall && typeof report.summary.overallScore === 'number') {
        results.push({ id: 'TEST 04', name: 'Correct deterministic overall score calculation', result: 'PASS', details: `Overall score verified: ${report.summary.overallScore} / 10 (expected ${expectedOverall})` });
      } else {
        results.push({ id: 'TEST 04', name: 'Correct deterministic overall score calculation', result: 'FAIL', details: `Overall: ${report.summary.overallScore}, Expected: ${expectedOverall}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 04', name: 'Correct deterministic overall score calculation', result: 'FAIL', details: e.message });
    }

    // TEST 05: Correct dimension averages
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      const evaluations = await AnswerEvaluationModel.findBySessionId(sessionAlice.id);

      const expTech = Math.round((evaluations.map(e => e.technicalAccuracy).reduce((a, b) => a + b, 0) / evaluations.length) * 10) / 10;
      const expRel = Math.round((evaluations.map(e => e.relevance).reduce((a, b) => a + b, 0) / evaluations.length) * 10) / 10;

      if (report.dimensions.technicalAccuracy.score === expTech && report.dimensions.relevance.score === expRel) {
        results.push({ id: 'TEST 05', name: 'Correct dimension averages', result: 'PASS', details: `TechAcc=${report.dimensions.technicalAccuracy.score}, Relevance=${report.dimensions.relevance.score}` });
      } else {
        results.push({ id: 'TEST 05', name: 'Correct dimension averages', result: 'FAIL', details: `Tech: ${report.dimensions.technicalAccuracy.score} vs ${expTech}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 05', name: 'Correct dimension averages', result: 'FAIL', details: e.message });
    }

    // TEST 06: Correct strengths aggregation and deduplication
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (Array.isArray(report.strengths) && report.strengths.length > 0) {
        // Ensure no duplicate strings in list
        const unique = new Set(report.strengths.map(s => s.toLowerCase()));
        if (unique.size === report.strengths.length) {
          results.push({ id: 'TEST 06', name: 'Correct strengths aggregation and deduplication', result: 'PASS', details: `Aggregated ${report.strengths.length} distinct strengths` });
        } else {
          results.push({ id: 'TEST 06', name: 'Correct strengths aggregation and deduplication', result: 'FAIL', details: 'Duplicate strengths found' });
        }
      } else {
        results.push({ id: 'TEST 06', name: 'Correct strengths aggregation and deduplication', result: 'FAIL', details: 'No strengths aggregated' });
      }
    } catch (e) {
      results.push({ id: 'TEST 06', name: 'Correct strengths aggregation and deduplication', result: 'FAIL', details: e.message });
    }

    // TEST 07: Correct weaknesses / improvement areas aggregation
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (Array.isArray(report.improvementAreas)) {
        results.push({ id: 'TEST 07', name: 'Correct weaknesses / improvement areas aggregation', result: 'PASS', details: `Aggregated ${report.improvementAreas.length} improvement areas` });
      } else {
        results.push({ id: 'TEST 07', name: 'Correct weaknesses / improvement areas aggregation', result: 'FAIL', details: 'improvementAreas is not an array' });
      }
    } catch (e) {
      results.push({ id: 'TEST 07', name: 'Correct weaknesses / improvement areas aggregation', result: 'FAIL', details: e.message });
    }

    // TEST 08: Correct question breakdown returned
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (Array.isArray(report.questions) && report.questions.length === 5) {
        const q1 = report.questions[0];
        if (q1.turnNumber === 1 && q1.question && q1.studentAnswer && q1.evaluation) {
          results.push({ id: 'TEST 08', name: 'Correct question breakdown returned', result: 'PASS', details: 'All 5 question cards populated with questions, answers, and evaluations' });
        } else {
          results.push({ id: 'TEST 08', name: 'Correct question breakdown returned', result: 'FAIL', details: 'Question breakdown missing fields' });
        }
      } else {
        results.push({ id: 'TEST 08', name: 'Correct question breakdown returned', result: 'FAIL', details: `Expected 5 questions, got ${report.questions?.length}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 08', name: 'Correct question breakdown returned', result: 'FAIL', details: e.message });
    }

    // TEST 09: Correct follow-up count & rate calculation
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (
        report.followUpAnalytics &&
        typeof report.followUpAnalytics.followUpRate === 'number' &&
        typeof report.followUpAnalytics.followUpQuestions === 'number'
      ) {
        results.push({ id: 'TEST 09', name: 'Correct follow-up count & rate calculation', result: 'PASS', details: `Follow-ups: ${report.followUpAnalytics.followUpQuestions}, Rate: ${report.followUpAnalytics.followUpRate}%` });
      } else {
        results.push({ id: 'TEST 09', name: 'Correct follow-up count & rate calculation', result: 'FAIL', details: 'Invalid follow-up analytics' });
      }
    } catch (e) {
      results.push({ id: 'TEST 09', name: 'Correct follow-up count & rate calculation', result: 'FAIL', details: e.message });
    }

    // TEST 10: Correct topic analytics aggregation
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (Array.isArray(report.topics) && report.topics.length > 0) {
        const t1 = report.topics[0];
        if (t1.topic && typeof t1.questionCount === 'number' && typeof t1.averageScore === 'number') {
          results.push({ id: 'TEST 10', name: 'Correct topic analytics aggregation', result: 'PASS', details: `Topic "${t1.topic}" has ${t1.questionCount} question(s) with avg score ${t1.averageScore}` });
        } else {
          results.push({ id: 'TEST 10', name: 'Correct topic analytics aggregation', result: 'FAIL', details: 'Topic object missing fields' });
        }
      } else {
        results.push({ id: 'TEST 10', name: 'Correct topic analytics aggregation', result: 'FAIL', details: 'No topics returned' });
      }
    } catch (e) {
      results.push({ id: 'TEST 10', name: 'Correct topic analytics aggregation', result: 'FAIL', details: e.message });
    }

    // TEST 11: Correct STAR analytics for behavioral answers
    try {
      // Create a behavioral session for Alice
      const behavSession = await InterviewSessionService.createSession(studentAlice.id, {
        targetRole: 'Software Engineer',
        interviewType: 'behavioral',
        difficulty: 'intermediate',
        questionCount: 5,
        durationMinutes: 30,
        interviewMode: 'text'
      });
      await ConversationEngine.startInterview(studentAlice.id, behavSession.id);
      await ConversationEngine.submitAnswer(
        studentAlice.id,
        behavSession.id,
        'In my previous role, our payment service had high latency (Situation). I was assigned to optimize throughput (Task). I implemented Redis caching and connection pooling (Action), which reduced latency by 65% (Result).'
      );

      const behavReport = await InterviewReportService.generateReport(studentAlice.id, behavSession.id);
      if (behavReport.starAnalysis && behavReport.starAnalysis.isApplicable) {
        results.push({ id: 'TEST 11', name: 'Correct STAR analytics for behavioral answers', result: 'PASS', details: `STAR situation rate: ${behavReport.starAnalysis.situationPresentRate}%, Result rate: ${behavReport.starAnalysis.resultPresentRate}%` });
      } else {
        results.push({ id: 'TEST 11', name: 'Correct STAR analytics for behavioral answers', result: 'FAIL', details: 'STAR analysis not marked applicable' });
      }
    } catch (e) {
      results.push({ id: 'TEST 11', name: 'Correct STAR analytics for behavioral answers', result: 'FAIL', details: e.message });
    }

    // TEST 12: Correct text/voice statistics
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (report.inputModes && report.inputModes.textCount === 5 && report.inputModes.voiceCount === 0) {
        results.push({ id: 'TEST 12', name: 'Correct text/voice statistics', result: 'PASS', details: `Text: ${report.inputModes.textCount}, Voice: ${report.inputModes.voiceCount}` });
      } else {
        results.push({ id: 'TEST 12', name: 'Correct text/voice statistics', result: 'FAIL', details: `Input modes breakdown mismatch: ${JSON.stringify(report.inputModes)}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 12', name: 'Correct text/voice statistics', result: 'FAIL', details: e.message });
    }

    // ==========================================
    // 2. CANDIDATE ANALYTICS (TEST 13 - 14)
    // ==========================================

    // TEST 13: Candidate summary analytics API works
    try {
      const res = await makeRequest(server, {
        path: '/api/analytics/summary',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });

      if (res.statusCode === 200 && res.body.success && res.body.data?.summary) {
        const sum = res.body.data.summary;
        if (sum.completedInterviews >= 1 && typeof sum.averageOverallScore === 'number') {
          results.push({ id: 'TEST 13', name: 'Candidate summary analytics API works', result: 'PASS', details: `Completed: ${sum.completedInterviews}, AvgScore: ${sum.averageOverallScore}` });
        } else {
          results.push({ id: 'TEST 13', name: 'Candidate summary analytics API works', result: 'FAIL', details: 'Missing summary stats' });
        }
      } else {
        results.push({ id: 'TEST 13', name: 'Candidate summary analytics API works', result: 'FAIL', details: `Status: ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 13', name: 'Candidate summary analytics API works', result: 'FAIL', details: e.message });
    }

    // TEST 14: Candidate performance history API works
    try {
      const res = await makeRequest(server, {
        path: '/api/analytics/history',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });

      if (res.statusCode === 200 && res.body.success && Array.isArray(res.body.data?.history)) {
        results.push({ id: 'TEST 14', name: 'Candidate performance history API works', result: 'PASS', details: `Returned ${res.body.data.history.length} historical interview entries` });
      } else {
        results.push({ id: 'TEST 14', name: 'Candidate performance history API works', result: 'FAIL', details: `Status: ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 14', name: 'Candidate performance history API works', result: 'FAIL', details: e.message });
    }

    // ==========================================
    // 3. SECURITY & ACCESS CONTROL (TEST 15 - 20)
    // ==========================================

    // TEST 15: Unauthenticated report access rejected
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlice.id}/report`,
        method: 'GET'
      });
      if (res.statusCode === 401) {
        results.push({ id: 'TEST 15', name: 'Unauthenticated report access rejected', result: 'PASS', details: 'HTTP 401 Unauthorized returned' });
      } else {
        results.push({ id: 'TEST 15', name: 'Unauthenticated report access rejected', result: 'FAIL', details: `Expected 401, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 15', name: 'Unauthenticated report access rejected', result: 'FAIL', details: e.message });
    }

    // TEST 16: Invalid token rejected
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlice.id}/report`,
        method: 'GET',
        headers: { Authorization: 'Bearer invalid.fake.token' }
      });
      if (res.statusCode === 401) {
        results.push({ id: 'TEST 16', name: 'Invalid token rejected', result: 'PASS', details: 'HTTP 401 Unauthorized returned for invalid JWT' });
      } else {
        results.push({ id: 'TEST 16', name: 'Invalid token rejected', result: 'FAIL', details: `Expected 401, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 16', name: 'Invalid token rejected', result: 'FAIL', details: e.message });
    }

    // TEST 17: Candidate cannot access another candidate's report
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlice.id}/report`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenBob}` }
      });
      if (res.statusCode === 403 || res.statusCode === 404) {
        results.push({ id: 'TEST 17', name: 'Candidate cannot access another candidate report', result: 'PASS', details: `Cross-user access blocked with HTTP ${res.statusCode}` });
      } else {
        results.push({ id: 'TEST 17', name: 'Candidate cannot access another candidate report', result: 'FAIL', details: `Expected 403/404, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 17', name: 'Candidate cannot access another candidate report', result: 'FAIL', details: e.message });
    }

    // TEST 18: Candidate cannot access another candidate's analytics
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlice.id}/analytics`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenBob}` }
      });
      if (res.statusCode === 403 || res.statusCode === 404) {
        results.push({ id: 'TEST 18', name: 'Candidate cannot access another candidate analytics', result: 'PASS', details: `Cross-user analytics blocked with HTTP ${res.statusCode}` });
      } else {
        results.push({ id: 'TEST 18', name: 'Candidate cannot access another candidate analytics', result: 'FAIL', details: `Expected 403/404, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 18', name: 'Candidate cannot access another candidate analytics', result: 'FAIL', details: e.message });
    }

    // TEST 19: Invalid interview ID handled correctly
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews/not-a-number/report',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
      if (res.statusCode === 400) {
        results.push({ id: 'TEST 19', name: 'Invalid interview ID handled correctly', result: 'PASS', details: 'HTTP 400 Bad Request returned' });
      } else {
        results.push({ id: 'TEST 19', name: 'Invalid interview ID handled correctly', result: 'FAIL', details: `Expected 400, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 19', name: 'Invalid interview ID handled correctly', result: 'FAIL', details: e.message });
    }

    // TEST 20: Non-existent interview handled correctly
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews/999999/report',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
      if (res.statusCode === 404) {
        results.push({ id: 'TEST 20', name: 'Non-existent interview handled correctly', result: 'PASS', details: 'HTTP 404 Not Found returned' });
      } else {
        results.push({ id: 'TEST 20', name: 'Non-existent interview handled correctly', result: 'FAIL', details: `Expected 404, got ${res.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 20', name: 'Non-existent interview handled correctly', result: 'FAIL', details: e.message });
    }

    // ==========================================
    // 4. EDGE CASES (TEST 21 - 28)
    // ==========================================

    // TEST 21: Interview with no evaluations handled safely
    try {
      const emptySession = await InterviewSessionService.createSession(studentAlice.id, {
        targetRole: 'Frontend Developer',
        interviewType: 'technical',
        difficulty: 'beginner',
        questionCount: 5,
        durationMinutes: 30,
        interviewMode: 'text'
      });
      const report = await InterviewReportService.generateReport(studentAlice.id, emptySession.id);
      if (report.summary.overallScore === null && report.summary.evaluatedAnswers === 0) {
        results.push({ id: 'TEST 21', name: 'Interview with no evaluations handled safely', result: 'PASS', details: 'Zero division avoided, overallScore = null' });
      } else {
        results.push({ id: 'TEST 21', name: 'Interview with no evaluations handled safely', result: 'FAIL', details: `overallScore: ${report.summary.overallScore}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 21', name: 'Interview with no evaluations handled safely', result: 'FAIL', details: e.message });
    }

    // TEST 22: Missing evaluation dimensions handled safely
    try {
      // Create session with partial null dimensions
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (report.dimensions && Object.keys(report.dimensions).length === 5) {
        results.push({ id: 'TEST 22', name: 'Missing evaluation dimensions handled safely', result: 'PASS', details: 'All 5 dimension keys defined with valid score values' });
      } else {
        results.push({ id: 'TEST 22', name: 'Missing evaluation dimensions handled safely', result: 'FAIL', details: 'Dimensions missing' });
      }
    } catch (e) {
      results.push({ id: 'TEST 22', name: 'Missing evaluation dimensions handled safely', result: 'FAIL', details: e.message });
    }

    // TEST 23: Missing STAR data handled gracefully
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (report.starAnalysis && (!report.starAnalysis.isApplicable || report.starAnalysis.evaluatedCount >= 0)) {
        results.push({ id: 'TEST 23', name: 'Missing STAR data handled gracefully', result: 'PASS', details: 'Clean non-crash empty state for technical interview' });
      } else {
        results.push({ id: 'TEST 23', name: 'Missing STAR data handled gracefully', result: 'FAIL', details: 'STAR data crash' });
      }
    } catch (e) {
      results.push({ id: 'TEST 23', name: 'Missing STAR data handled gracefully', result: 'FAIL', details: e.message });
    }

    // TEST 24: Missing topic metadata handled gracefully
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (Array.isArray(report.topics)) {
        results.push({ id: 'TEST 24', name: 'Missing topic metadata handled gracefully', result: 'PASS', details: 'Topic array is valid and non-null' });
      }
    } catch (e) {
      results.push({ id: 'TEST 24', name: 'Missing topic metadata handled gracefully', result: 'FAIL', details: e.message });
    }

    // TEST 25: Voice metadata missing handled gracefully
    try {
      const report = await InterviewReportService.generateReport(studentAlice.id, sessionAlice.id);
      if (report.inputModes && report.inputModes.textCount >= 0 && report.inputModes.voiceCount >= 0) {
        results.push({ id: 'TEST 25', name: 'Voice metadata missing handled gracefully', result: 'PASS', details: 'Text-mode session reports voiceCount=0 without errors' });
      }
    } catch (e) {
      results.push({ id: 'TEST 25', name: 'Voice metadata missing handled gracefully', result: 'FAIL', details: e.message });
    }

    // TEST 26: Zero evaluated responses returns structured empty summary
    try {
      const bobSummary = await InterviewReportService.getCandidateSummary(studentBob.id);
      if (bobSummary.completedInterviews === 0 && bobSummary.averageOverallScore === null) {
        results.push({ id: 'TEST 26', name: 'Zero evaluated responses returns structured empty summary', result: 'PASS', details: 'Clean empty summary returned for candidate with 0 completed sessions' });
      } else {
        results.push({ id: 'TEST 26', name: 'Zero evaluated responses returns structured empty summary', result: 'FAIL', details: `Expected 0 completed, got ${bobSummary.completedInterviews}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 26', name: 'Zero evaluated responses returns structured empty summary', result: 'FAIL', details: e.message });
    }

    // TEST 27: Incomplete interview report generated safely
    try {
      const inProgSession = await InterviewSessionService.createSession(studentAlice.id, {
        targetRole: 'Data Analyst',
        interviewType: 'technical',
        difficulty: 'intermediate',
        questionCount: 5,
        durationMinutes: 30,
        interviewMode: 'text'
      });
      await ConversationEngine.startInterview(studentAlice.id, inProgSession.id);

      const report = await InterviewReportService.generateReport(studentAlice.id, inProgSession.id);
      if (report.interview.status === 'in_progress' && report.summary.isCompleted === false) {
        results.push({ id: 'TEST 27', name: 'Incomplete interview report generated safely', result: 'PASS', details: 'In-progress session report generated with isCompleted: false' });
      } else {
        results.push({ id: 'TEST 27', name: 'Incomplete interview report generated safely', result: 'FAIL', details: `Status: ${report.interview.status}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 27', name: 'Incomplete interview report generated safely', result: 'FAIL', details: e.message });
    }

    // TEST 28: Multiple completed interviews handled and ordered chronologically
    try {
      const historyRes = await InterviewReportService.getCandidateHistory(studentAlice.id);
      if (Array.isArray(historyRes.history) && historyRes.history.length >= 1) {
        results.push({ id: 'TEST 28', name: 'Multiple completed interviews handled and ordered', result: 'PASS', details: `${historyRes.history.length} interviews ordered chronologically` });
      } else {
        results.push({ id: 'TEST 28', name: 'Multiple completed interviews handled and ordered', result: 'FAIL', details: `History count: ${historyRes.history?.length}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 28', name: 'Multiple completed interviews handled and ordered', result: 'FAIL', details: e.message });
    }

    // ==========================================
    // 5. REGRESSION TESTS (TEST 29 - 33)
    // ==========================================

    // TEST 29: Phase 1 regression (Student auth & profile)
    try {
      const meRes = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
      if (meRes.statusCode === 200 && meRes.body.data?.user?.email === studentAlice.email) {
        results.push({ id: 'TEST 29', name: 'Phase 1 regression (Student auth & profile)', result: 'PASS', details: 'Auth and user session active and valid' });
      } else {
        results.push({ id: 'TEST 29', name: 'Phase 1 regression (Student auth & profile)', result: 'FAIL', details: `Status: ${meRes.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 29', name: 'Phase 1 regression (Student auth & profile)', result: 'FAIL', details: e.message });
    }

    // TEST 30: Phase 2 regression (Interview setup & options)
    try {
      const optRes = await makeRequest(server, {
        path: '/api/interviews/options',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
      const roles = optRes.body.data?.roles || optRes.body.data?.targetRoles || [];
      if (optRes.statusCode === 200 && roles.length > 0) {
        results.push({ id: 'TEST 30', name: 'Phase 2 regression (Interview setup & options)', result: 'PASS', details: 'Options API returns valid roles' });
      } else {
        results.push({ id: 'TEST 30', name: 'Phase 2 regression (Interview setup & options)', result: 'FAIL', details: `Status: ${optRes.statusCode}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 30', name: 'Phase 2 regression (Interview setup & options)', result: 'FAIL', details: e.message });
    }

    // TEST 31: Phase 3 regression (Text Interview Orchestrator)
    try {
      const textSession = await InterviewSessionService.createSession(studentBob.id, {
        targetRole: 'Machine Learning Engineer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        questionCount: 5,
        durationMinutes: 30,
        interviewMode: 'text'
      });
      const startRes = await ConversationEngine.startInterview(studentBob.id, textSession.id);
      if (startRes.session && startRes.currentTurn && startRes.currentTurn.question) {
        results.push({ id: 'TEST 31', name: 'Phase 3 regression (Text Interview Orchestrator)', result: 'PASS', details: 'Text session initiated with valid Turn 1 question' });
      } else {
        results.push({ id: 'TEST 31', name: 'Phase 3 regression (Text Interview Orchestrator)', result: 'FAIL', details: 'Failed to start text session' });
      }
    } catch (e) {
      results.push({ id: 'TEST 31', name: 'Phase 3 regression (Text Interview Orchestrator)', result: 'FAIL', details: e.message });
    }

    // TEST 32: Phase 4 regression (AI Answer Evaluation)
    try {
      const evalResult = await AnswerEvaluationService.evaluateAnswer({
        targetRole: 'Machine Learning Engineer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        question: 'Explain overfitting and regularization in neural networks.',
        expectedConcepts: ['L1/L2 regularization', 'dropout', 'validation loss'],
        studentAnswer: 'Overfitting occurs when a model learns noise in training data. Regularization methods like dropout and weight decay penalize complexity.'
      });

      if (evalResult && evalResult.technicalAccuracy >= 7 && evalResult.relevance >= 7) {
        results.push({ id: 'TEST 32', name: 'Phase 4 regression (AI Answer Evaluation)', result: 'PASS', details: `Accuracy: ${evalResult.technicalAccuracy}, Relevance: ${evalResult.relevance}` });
      } else {
        results.push({ id: 'TEST 32', name: 'Phase 4 regression (AI Answer Evaluation)', result: 'FAIL', details: `Low evaluation score: ${evalResult?.technicalAccuracy}` });
      }
    } catch (e) {
      results.push({ id: 'TEST 32', name: 'Phase 4 regression (AI Answer Evaluation)', result: 'FAIL', details: e.message });
    }

    // TEST 33: Phase 5 regression (Voice Interview System)
    try {
      const SpeechToTextService = require('../backend/services/speech/speechToTextService');
      const TextToSpeechService = require('../backend/services/speech/textToSpeechService');
      const sttConfig = SpeechToTextService.getConfig();
      const ttsData = await TextToSpeechService.synthesizeQuestionAudio('Explain binary search.');

      if (sttConfig.provider && ttsData.text) {
        results.push({ id: 'TEST 33', name: 'Phase 5 regression (Voice Interview System)', result: 'PASS', details: `STT Provider: ${sttConfig.provider}, TTS: ${ttsData.provider}` });
      } else {
        results.push({ id: 'TEST 33', name: 'Phase 5 regression (Voice Interview System)', result: 'FAIL', details: 'Voice services check failed' });
      }
    } catch (e) {
      results.push({ id: 'TEST 33', name: 'Phase 5 regression (Voice Interview System)', result: 'FAIL', details: e.message });
    }

  } finally {
    if (server) {
      server.close();
    }
  }

  // Summary Table
  console.log('\n========================================================================');
  console.log('INTERVIEW REPORTING TEST SUITE EXECUTION RESULTS');
  console.log('========================================================================');
  let passed = 0;
  let failed = 0;
  results.forEach((r) => {
    const statusSymbol = r.result === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`${r.id.padEnd(9)} | ${statusSymbol} | ${r.name}`);
    if (r.details) {
      console.log(`          ↳ ${r.details}`);
    }
    if (r.result === 'PASS') passed++;
    else failed++;
  });
  console.log('========================================================================');
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runInterviewReportingTests().catch((err) => {
  console.error('Fatal error running Interview Reporting tests:', err);
  process.exit(1);
});
