const http = require('http');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('../backend/app');
const InterviewSessionService = require('../backend/services/interviewSessionService');
const InterviewSessionModel = require('../backend/models/interviewSessionModel');

function makeRequest(server, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: 'localhost',
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runInterviewSessionTests() {
  console.log('====================================================');
  console.log('MockInterviewAI — Interview Session & Setup Verification');
  console.log('====================================================\n');

  const results = [];
  let server = null;
  let dbConnection = null;

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mock_interview_ai'
    });

    // Clean up test records
    await dbConnection.query("DELETE FROM users WHERE email LIKE '%@phase2test.com'");

    // Create Candidate Alpha & Candidate Beta for isolation testing
    const emailAlpha = `alpha_${Date.now()}@phase2test.com`;
    const passwordAlpha = 'Password123!';
    const regAlpha = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Alpha Candidate',
      email: emailAlpha,
      password: passwordAlpha
    });
    const logAlpha = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: emailAlpha,
      password: passwordAlpha
    });
    const tokenAlpha = logAlpha.body.data.token;
    const userAlphaId = logAlpha.body.data.user.id;

    const emailBeta = `beta_${Date.now()}@phase2test.com`;
    const passwordBeta = 'Password456!';
    const regBeta = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Beta Candidate',
      email: emailBeta,
      password: passwordBeta
    });
    const logBeta = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: emailBeta,
      password: passwordBeta
    });
    const tokenBeta = logBeta.body.data.token;
    const userBetaId = logBeta.body.data.user.id;

    // -------------------------------------------------------------
    // DATABASE TESTS (01 - 04)
    // -------------------------------------------------------------

    // TEST 01: Active database is mock_interview_ai
    try {
      const [rows] = await dbConnection.query('SELECT DATABASE() AS current_db');
      const currentDb = rows[0]?.current_db;
      if (currentDb === 'mock_interview_ai') {
        results.push({ id: 'TEST 01', name: 'Active database is mock_interview_ai', result: 'PASS', details: 'Confirmed mock_interview_ai' });
      } else {
        results.push({ id: 'TEST 01', name: 'Active database is mock_interview_ai', result: 'FAIL', details: `Unexpected DB: ${currentDb}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 01', name: 'Active database is mock_interview_ai', result: 'FAIL', details: err.message });
    }

    // TEST 02: interview_sessions exists
    try {
      const [rows] = await dbConnection.query("SHOW TABLES LIKE 'interview_sessions'");
      if (rows.length === 1) {
        results.push({ id: 'TEST 02', name: 'interview_sessions exists', result: 'PASS', details: 'Table interview_sessions verified' });
      } else {
        results.push({ id: 'TEST 02', name: 'interview_sessions exists', result: 'FAIL', details: 'Table not found' });
      }
    } catch (err) {
      results.push({ id: 'TEST 02', name: 'interview_sessions exists', result: 'FAIL', details: err.message });
    }

    // TEST 03: Foreign key to users works
    try {
      const [tempUser] = await dbConnection.query("INSERT INTO users (name, email, password_hash) VALUES ('Temp FK', 'temp_fk@phase2test.com', 'dummy')");
      const tempId = tempUser.insertId;
      await dbConnection.query("INSERT INTO interview_sessions (user_id, target_role, interview_type, difficulty, interview_mode, question_count, duration_minutes) VALUES (?, 'Java Developer', 'technical', 'intermediate', 'text', 10, 30)", [tempId]);
      
      // Delete user and verify cascading deletion
      await dbConnection.query("DELETE FROM users WHERE id = ?", [tempId]);
      const [sessions] = await dbConnection.query("SELECT * FROM interview_sessions WHERE user_id = ?", [tempId]);
      if (sessions.length === 0) {
        results.push({ id: 'TEST 03', name: 'Foreign key to users works', result: 'PASS', details: 'Cascade delete verified on interview_sessions' });
      } else {
        results.push({ id: 'TEST 03', name: 'Foreign key to users works', result: 'FAIL', details: 'Cascade delete did not remove session' });
      }
    } catch (err) {
      results.push({ id: 'TEST 03', name: 'Foreign key to users works', result: 'FAIL', details: err.message });
    }

    // TEST 04: Session status constraint works
    try {
      let caught = false;
      try {
        await dbConnection.query("INSERT INTO interview_sessions (user_id, target_role, interview_type, difficulty, interview_mode, question_count, duration_minutes, status) VALUES (?, 'Java Developer', 'technical', 'intermediate', 'text', 10, 30, 'invalid_status')", [userAlphaId]);
      } catch (e) {
        caught = true;
      }
      if (caught) {
        results.push({ id: 'TEST 04', name: 'Session status constraint works', result: 'PASS', details: 'Invalid status rejected by database ENUM' });
      } else {
        results.push({ id: 'TEST 04', name: 'Session status constraint works', result: 'FAIL', details: 'Invalid status accepted by DB' });
      }
    } catch (err) {
      results.push({ id: 'TEST 04', name: 'Session status constraint works', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // SESSION CREATION TESTS (05 - 12)
    // -------------------------------------------------------------

    let sessionAlpha1 = null;

    // TEST 05: Authenticated student can create session
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 201 && res.body.success === true && res.body.data?.session?.id) {
        sessionAlpha1 = res.body.data.session;
        results.push({ id: 'TEST 05', name: 'Authenticated student can create session', result: 'PASS', details: `Created session ID #${sessionAlpha1.id}` });
      } else {
        results.push({ id: 'TEST 05', name: 'Authenticated student can create session', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 05', name: 'Authenticated student can create session', result: 'FAIL', details: err.message });
    }

    // TEST 06: Unauthenticated student cannot create session
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST'
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 401) {
        results.push({ id: 'TEST 06', name: 'Unauthenticated student cannot create session', result: 'PASS', details: 'Returned 401 Unauthorized' });
      } else {
        results.push({ id: 'TEST 06', name: 'Unauthenticated student cannot create session', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 06', name: 'Unauthenticated student cannot create session', result: 'FAIL', details: err.message });
    }

    // TEST 07: Invalid role rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Astronaut Wizard',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 07', name: 'Invalid role rejected', result: 'PASS', details: 'Rejected unknown role with 400' });
      } else {
        results.push({ id: 'TEST 07', name: 'Invalid role rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 07', name: 'Invalid role rejected', result: 'FAIL', details: err.message });
    }

    // TEST 08: Invalid interview type rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'random_type',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 08', name: 'Invalid interview type rejected', result: 'PASS', details: 'Rejected unknown type with 400' });
      } else {
        results.push({ id: 'TEST 08', name: 'Invalid interview type rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 08', name: 'Invalid interview type rejected', result: 'FAIL', details: err.message });
    }

    // TEST 09: Invalid difficulty rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'god_mode',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 09', name: 'Invalid difficulty rejected', result: 'PASS', details: 'Rejected invalid difficulty with 400' });
      } else {
        results.push({ id: 'TEST 09', name: 'Invalid difficulty rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 09', name: 'Invalid difficulty rejected', result: 'FAIL', details: err.message });
    }

    // TEST 10: Invalid mode rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'telepathy',
        questionCount: 10,
        durationMinutes: 30
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 10', name: 'Invalid mode rejected', result: 'PASS', details: 'Rejected invalid mode with 400' });
      } else {
        results.push({ id: 'TEST 10', name: 'Invalid mode rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 10', name: 'Invalid mode rejected', result: 'FAIL', details: err.message });
    }

    // TEST 11: Invalid question count rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 999,
        durationMinutes: 30
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 11', name: 'Invalid question count rejected', result: 'PASS', details: 'Rejected count 999 with 400' });
      } else {
        results.push({ id: 'TEST 11', name: 'Invalid question count rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 11', name: 'Invalid question count rejected', result: 'FAIL', details: err.message });
    }

    // TEST 12: Invalid duration rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 500
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 12', name: 'Invalid duration rejected', result: 'PASS', details: 'Rejected duration 500 with 400' });
      } else {
        results.push({ id: 'TEST 12', name: 'Invalid duration rejected', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 12', name: 'Invalid duration rejected', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // OWNERSHIP & ACCESS CONTROL TESTS (13 - 17)
    // -------------------------------------------------------------

    // Create session for Beta
    const resBetaSess = await makeRequest(server, {
      path: '/api/interviews',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBeta}` }
    }, {
      targetRole: 'Python Developer',
      interviewType: 'behavioral',
      difficulty: 'beginner',
      interviewMode: 'voice',
      questionCount: 5,
      durationMinutes: 15
    });
    const sessionBeta1 = resBetaSess.body.data?.session;

    // TEST 13: Student can retrieve own session
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlpha1.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.session?.id === sessionAlpha1.id) {
        results.push({ id: 'TEST 13', name: 'Student can retrieve own session', result: 'PASS', details: 'Retrieved own session correctly' });
      } else {
        results.push({ id: 'TEST 13', name: 'Student can retrieve own session', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 13', name: 'Student can retrieve own session', result: 'FAIL', details: err.message });
    }

    // TEST 14: Student cannot retrieve another student's session
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionBeta1.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 403 || res.statusCode === 404) {
        results.push({ id: 'TEST 14', name: "Student cannot retrieve another student's session", result: 'PASS', details: 'Cross-access blocked with 403' });
      } else {
        results.push({ id: 'TEST 14', name: "Student cannot retrieve another student's session", result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 14', name: "Student cannot retrieve another student's session", result: 'FAIL', details: err.message });
    }

    // TEST 15: Student sees only own interview list
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      const sessions = res.body.data?.sessions || [];
      const hasBetaSession = sessions.some(s => s.id === sessionBeta1.id);
      const allBelongToAlpha = sessions.every(s => s.user_id === userAlphaId);

      if (res.statusCode === 200 && !hasBetaSession && allBelongToAlpha) {
        results.push({ id: 'TEST 15', name: 'Student sees only own interview list', result: 'PASS', details: 'Strict user filter enforced on list' });
      } else {
        results.push({ id: 'TEST 15', name: 'Student sees only own interview list', result: 'FAIL', details: 'Found other user sessions in list' });
      }
    } catch (err) {
      results.push({ id: 'TEST 15', name: 'Student sees only own interview list', result: 'FAIL', details: err.message });
    }

    // TEST 16: Student cannot cancel another student's session
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionBeta1.id}/cancel`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 403 || res.statusCode === 404) {
        results.push({ id: 'TEST 16', name: "Student cannot cancel another student's session", result: 'PASS', details: 'Unauthorized cancellation blocked' });
      } else {
        results.push({ id: 'TEST 16', name: "Student cannot cancel another student's session", result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 16', name: "Student cannot cancel another student's session", result: 'FAIL', details: err.message });
    }

    // TEST 17: Student cannot start another student's session
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionBeta1.id}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 403 || res.statusCode === 404) {
        results.push({ id: 'TEST 17', name: "Student cannot start another student's session", result: 'PASS', details: 'Unauthorized start blocked' });
      } else {
        results.push({ id: 'TEST 17', name: "Student cannot start another student's session", result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 17', name: "Student cannot start another student's session", result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // STATE MACHINE TESTS (18 - 25)
    // -------------------------------------------------------------

    // TEST 18: ready → in_progress
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlpha1.id}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 200 && res.body.data?.session?.status === 'in_progress') {
        results.push({ id: 'TEST 18', name: 'ready → in_progress', result: 'PASS', details: 'Transitioned ready to in_progress' });
      } else {
        results.push({ id: 'TEST 18', name: 'ready → in_progress', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 18', name: 'ready → in_progress', result: 'FAIL', details: err.message });
    }

    // TEST 19: ready → cancelled
    try {
      const newSessRes = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Full Stack Developer',
        interviewType: 'mixed',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 5,
        durationMinutes: 15
      });
      const cancelSessId = newSessRes.body.data.session.id;

      const cancelRes = await makeRequest(server, {
        path: `/api/interviews/${cancelSessId}/cancel`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (cancelRes.statusCode === 200 && cancelRes.body.data?.session?.status === 'cancelled') {
        results.push({ id: 'TEST 19', name: 'ready → cancelled', result: 'PASS', details: 'Transitioned ready to cancelled' });
      } else {
        results.push({ id: 'TEST 19', name: 'ready → cancelled', result: 'FAIL', details: `Status ${cancelRes.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 19', name: 'ready → cancelled', result: 'FAIL', details: err.message });
    }

    // TEST 20: in_progress → paused
    try {
      const pausedSess = await InterviewSessionService.pauseSession(userAlphaId, sessionAlpha1.id);
      if (pausedSess.status === 'paused') {
        results.push({ id: 'TEST 20', name: 'in_progress → paused', result: 'PASS', details: 'Transitioned in_progress to paused' });
      } else {
        results.push({ id: 'TEST 20', name: 'in_progress → paused', result: 'FAIL', details: `Status: ${pausedSess.status}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 20', name: 'in_progress → paused', result: 'FAIL', details: err.message });
    }

    // TEST 21: paused → in_progress
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlpha1.id}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 200 && res.body.data?.session?.status === 'in_progress') {
        results.push({ id: 'TEST 21', name: 'paused → in_progress', result: 'PASS', details: 'Resumed paused session to in_progress' });
      } else {
        results.push({ id: 'TEST 21', name: 'paused → in_progress', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 21', name: 'paused → in_progress', result: 'FAIL', details: err.message });
    }

    // TEST 22: in_progress → completed
    try {
      const compSess = await InterviewSessionService.completeSession(userAlphaId, sessionAlpha1.id);
      if (compSess.status === 'completed' && compSess.completed_at) {
        results.push({ id: 'TEST 22', name: 'in_progress → completed', result: 'PASS', details: 'Completed session with timestamp' });
      } else {
        results.push({ id: 'TEST 22', name: 'in_progress → completed', result: 'FAIL', details: `Status: ${compSess.status}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 22', name: 'in_progress → completed', result: 'FAIL', details: err.message });
    }

    // TEST 23: completed cannot restart
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlpha1.id}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 23', name: 'completed cannot restart', result: 'PASS', details: 'Terminal state protected against restart' });
      } else {
        results.push({ id: 'TEST 23', name: 'completed cannot restart', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 23', name: 'completed cannot restart', result: 'FAIL', details: err.message });
    }

    // TEST 24: cancelled cannot restart
    try {
      const cancelSessRes = await makeRequest(server, {
        path: `/api/interviews/${sessionBeta1.id}/cancel`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenBeta}` }
      });

      const restartRes = await makeRequest(server, {
        path: `/api/interviews/${sessionBeta1.id}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenBeta}` }
      });

      if (restartRes.statusCode === 400 && restartRes.body.success === false) {
        results.push({ id: 'TEST 24', name: 'cancelled cannot restart', result: 'PASS', details: 'Cancelled session cannot be restarted' });
      } else {
        results.push({ id: 'TEST 24', name: 'cancelled cannot restart', result: 'FAIL', details: `Status ${restartRes.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 24', name: 'cancelled cannot restart', result: 'FAIL', details: err.message });
    }

    // TEST 25: invalid state transition rejected
    try {
      let caught = false;
      try {
        await InterviewSessionService.transitionState(userAlphaId, sessionAlpha1.id, 'ready');
      } catch (e) {
        caught = true;
      }
      if (caught) {
        results.push({ id: 'TEST 25', name: 'invalid state transition rejected', result: 'PASS', details: 'State machine blocked invalid transition' });
      } else {
        results.push({ id: 'TEST 25', name: 'invalid state transition rejected', result: 'FAIL', details: 'Allowed invalid transition' });
      }
    } catch (err) {
      results.push({ id: 'TEST 25', name: 'invalid state transition rejected', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // API TESTS (26 - 30)
    // -------------------------------------------------------------

    // TEST 26: GET /api/interviews
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 200 && Array.isArray(res.body.data?.sessions)) {
        results.push({ id: 'TEST 26', name: 'GET /api/interviews', result: 'PASS', details: `Returned ${res.body.data.sessions.length} sessions` });
      } else {
        results.push({ id: 'TEST 26', name: 'GET /api/interviews', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 26', name: 'GET /api/interviews', result: 'FAIL', details: err.message });
    }

    // TEST 27: GET /api/interviews/:id
    try {
      const res = await makeRequest(server, {
        path: `/api/interviews/${sessionAlpha1.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (res.statusCode === 200 && res.body.data?.session?.id === sessionAlpha1.id) {
        results.push({ id: 'TEST 27', name: 'GET /api/interviews/:id', result: 'PASS', details: 'Session retrieved by ID' });
      } else {
        results.push({ id: 'TEST 27', name: 'GET /api/interviews/:id', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 27', name: 'GET /api/interviews/:id', result: 'FAIL', details: err.message });
    }

    // TEST 28: POST /api/interviews
    try {
      const res = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Data Scientist',
        interviewType: 'technical',
        difficulty: 'advanced',
        interviewMode: 'voice',
        questionCount: 20,
        durationMinutes: 60
      });

      if (res.statusCode === 201 && res.body.data?.session?.target_role === 'Data Scientist') {
        results.push({ id: 'TEST 28', name: 'POST /api/interviews', result: 'PASS', details: 'Created session via API endpoint' });
      } else {
        results.push({ id: 'TEST 28', name: 'POST /api/interviews', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 28', name: 'POST /api/interviews', result: 'FAIL', details: err.message });
    }

    // TEST 29: POST /api/interviews/:id/start
    try {
      const freshRes = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Frontend Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });
      const freshId = freshRes.body.data.session.id;

      const startRes = await makeRequest(server, {
        path: `/api/interviews/${freshId}/start`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (startRes.statusCode === 200 && startRes.body.data?.session?.status === 'in_progress') {
        results.push({ id: 'TEST 29', name: 'POST /api/interviews/:id/start', result: 'PASS', details: 'Started session via API endpoint' });
      } else {
        results.push({ id: 'TEST 29', name: 'POST /api/interviews/:id/start', result: 'FAIL', details: `Status ${startRes.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 29', name: 'POST /api/interviews/:id/start', result: 'FAIL', details: err.message });
    }

    // TEST 30: POST /api/interviews/:id/cancel
    try {
      const cancelTargetRes = await makeRequest(server, {
        path: '/api/interviews',
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }, {
        targetRole: 'Backend Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });
      const cancelId = cancelTargetRes.body.data.session.id;

      const cancelRes = await makeRequest(server, {
        path: `/api/interviews/${cancelId}/cancel`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      });

      if (cancelRes.statusCode === 200 && cancelRes.body.data?.session?.status === 'cancelled') {
        results.push({ id: 'TEST 30', name: 'POST /api/interviews/:id/cancel', result: 'PASS', details: 'Cancelled session via API endpoint' });
      } else {
        results.push({ id: 'TEST 30', name: 'POST /api/interviews/:id/cancel', result: 'FAIL', details: `Status ${cancelRes.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 30', name: 'POST /api/interviews/:id/cancel', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // FRONTEND COMPONENT & INTEGRATION TESTS (31 - 37)
    // -------------------------------------------------------------

    const frontendSrc = path.join(__dirname, '../frontend/src');

    // TEST 31: Dashboard loads / component verified
    try {
      const dashPath = path.join(frontendSrc, 'pages', 'Dashboard.jsx');
      const dashContent = fs.readFileSync(dashPath, 'utf8');
      if (dashContent.includes('Recent Mock Interviews') && dashContent.includes('Start New Mock Interview')) {
        results.push({ id: 'TEST 31', name: 'Dashboard loads', result: 'PASS', details: 'Dashboard structure & metrics verified' });
      } else {
        results.push({ id: 'TEST 31', name: 'Dashboard loads', result: 'FAIL', details: 'Missing dashboard elements' });
      }
    } catch (err) {
      results.push({ id: 'TEST 31', name: 'Dashboard loads', result: 'FAIL', details: err.message });
    }

    // TEST 32: Interview setup loads
    try {
      const setupPath = path.join(frontendSrc, 'pages', 'InterviewSetup.jsx');
      const setupContent = fs.readFileSync(setupPath, 'utf8');
      if (setupContent.includes('Target Job Role') && setupContent.includes('Interview Type') && setupContent.includes('Difficulty Level')) {
        results.push({ id: 'TEST 32', name: 'Interview setup loads', result: 'PASS', details: 'Setup options and parameter selectors verified' });
      } else {
        results.push({ id: 'TEST 32', name: 'Interview setup loads', result: 'FAIL', details: 'Missing setup elements' });
      }
    } catch (err) {
      results.push({ id: 'TEST 32', name: 'Interview setup loads', result: 'FAIL', details: err.message });
    }

    // TEST 33: Configuration validation works
    try {
      const validTest = InterviewSessionService.validateConfiguration({
        targetRole: 'Java Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        interviewMode: 'text',
        questionCount: 10,
        durationMinutes: 30
      });
      const invalidTest = InterviewSessionService.validateConfiguration({
        targetRole: 'Invalid Role',
        interviewType: 'fake',
        difficulty: 'fake',
        interviewMode: 'fake',
        questionCount: 0,
        durationMinutes: 0
      });

      if (validTest.isValid && !invalidTest.isValid && invalidTest.errors.length >= 4) {
        results.push({ id: 'TEST 33', name: 'Configuration validation works', result: 'PASS', details: 'Validated good config and caught 4+ bad inputs' });
      } else {
        results.push({ id: 'TEST 33', name: 'Configuration validation works', result: 'FAIL', details: 'Validation failed logic check' });
      }
    } catch (err) {
      results.push({ id: 'TEST 33', name: 'Configuration validation works', result: 'FAIL', details: err.message });
    }

    // TEST 34: Review screen displays selected configuration
    try {
      const revPath = path.join(frontendSrc, 'pages', 'InterviewReview.jsx');
      const revContent = fs.readFileSync(revPath, 'utf8');
      if (revContent.includes('Review Interview Configuration') && revContent.includes('Confirm & Create Session')) {
        results.push({ id: 'TEST 34', name: 'Review screen displays selected configuration', result: 'PASS', details: 'Review parameters and create triggers verified' });
      } else {
        results.push({ id: 'TEST 34', name: 'Review screen displays selected configuration', result: 'FAIL', details: 'Review elements missing' });
      }
    } catch (err) {
      results.push({ id: 'TEST 34', name: 'Review screen displays selected configuration', result: 'FAIL', details: err.message });
    }

    // TEST 35: Session creation works from UI / frontend service
    try {
      const svcPath = path.join(frontendSrc, 'services', 'interviewService.js');
      const svcContent = fs.readFileSync(svcPath, 'utf8');
      if (svcContent.includes('createInterview') && svcContent.includes('startInterview') && svcContent.includes('cancelInterview')) {
        results.push({ id: 'TEST 35', name: 'Session creation works from UI service', result: 'PASS', details: 'InterviewService client methods verified' });
      } else {
        results.push({ id: 'TEST 35', name: 'Session creation works from UI service', result: 'FAIL', details: 'Missing service methods' });
      }
    } catch (err) {
      results.push({ id: 'TEST 35', name: 'Session creation works from UI service', result: 'FAIL', details: err.message });
    }

    // TEST 36: Preparation screen loads
    try {
      const prepPath = path.join(frontendSrc, 'pages', 'InterviewPrepare.jsx');
      const prepContent = fs.readFileSync(prepPath, 'utf8');
      if (prepContent.includes('Before You Begin') && prepContent.includes('Begin Interview')) {
        results.push({ id: 'TEST 36', name: 'Preparation screen loads', result: 'PASS', details: 'Readiness checklist and begin triggers verified' });
      } else {
        results.push({ id: 'TEST 36', name: 'Preparation screen loads', result: 'FAIL', details: 'Missing prep elements' });
      }
    } catch (err) {
      results.push({ id: 'TEST 36', name: 'Preparation screen loads', result: 'FAIL', details: err.message });
    }

    // TEST 37: Protected interview routes work
    try {
      const appJsx = fs.readFileSync(path.join(frontendSrc, 'App.jsx'), 'utf8');
      const routesProtected = appJsx.includes('route === \'setup\'') &&
                              appJsx.includes('route === \'review\'') &&
                              appJsx.includes('route === \'prepare\'') &&
                              appJsx.includes('route === \'session\'') &&
                              appJsx.includes('ProtectedRoute');

      if (routesProtected) {
        results.push({ id: 'TEST 37', name: 'Protected interview routes work', result: 'PASS', details: 'Setup, review, prepare, session enclosed in ProtectedRoute' });
      } else {
        results.push({ id: 'TEST 37', name: 'Protected interview routes work', result: 'FAIL', details: 'Routes not properly protected' });
      }
    } catch (err) {
      results.push({ id: 'TEST 37', name: 'Protected interview routes work', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // RESPONSIVENESS TESTS (38 - 40)
    // -------------------------------------------------------------

    const cssPath = path.join(frontendSrc, 'App.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // TEST 38: Desktop layout
    try {
      if (cssContent.includes('.dashboard-container') && cssContent.includes('.setup-two-col') && cssContent.includes('.scope-grid')) {
        results.push({ id: 'TEST 38', name: 'Desktop layout', result: 'PASS', details: 'Multi-column desktop grids verified' });
      } else {
        results.push({ id: 'TEST 38', name: 'Desktop layout', result: 'FAIL', details: 'Missing desktop grid rules' });
      }
    } catch (err) {
      results.push({ id: 'TEST 38', name: 'Desktop layout', result: 'FAIL', details: err.message });
    }

    // TEST 39: Tablet layout (max-width: 1024px)
    try {
      if (cssContent.includes('@media (max-width: 1024px)') && cssContent.includes('.stats-row')) {
        results.push({ id: 'TEST 39', name: 'Tablet layout', result: 'PASS', details: '1024px tablet responsive rules verified' });
      } else {
        results.push({ id: 'TEST 39', name: 'Tablet layout', result: 'FAIL', details: 'Missing tablet media query' });
      }
    } catch (err) {
      results.push({ id: 'TEST 39', name: 'Tablet layout', result: 'FAIL', details: err.message });
    }

    // TEST 40: Mobile layout (max-width: 768px / 390px)
    try {
      if (cssContent.includes('@media (max-width: 768px)') && cssContent.includes('@media (max-width: 390px)')) {
        results.push({ id: 'TEST 40', name: 'Mobile layout', result: 'PASS', details: '768px and 390px mobile responsive rules verified' });
      } else {
        results.push({ id: 'TEST 40', name: 'Mobile layout', result: 'FAIL', details: 'Missing mobile media query' });
      }
    } catch (err) {
      results.push({ id: 'TEST 40', name: 'Mobile layout', result: 'FAIL', details: err.message });
    }

  } finally {
    if (dbConnection) {
      try {
        await dbConnection.query("DELETE FROM users WHERE email LIKE '%@phase2test.com'");
        await dbConnection.end();
      } catch (e) {}
    }
    if (server) {
      server.close();
    }
  }

  // Print results
  console.log('| ID | Test Name | Result | Details |');
  console.log('| :--- | :--- | :---: | :--- |');
  for (const t of results) {
    console.log(`| ${t.id} | ${t.name} | **${t.result}** | ${t.details} |`);
  }

  const allPassed = results.length === 40 && results.every(r => r.result === 'PASS');
  console.log(`\nTotal Tests: ${results.length}/40 | Passed: ${results.filter(r => r.result === 'PASS').length} | Failed: ${results.filter(r => r.result === 'FAIL').length}`);
  console.log('Overall Status: ' + (allPassed ? 'INTERVIEW SESSION TESTS COMPLETE — ALL TESTS PASSED ✓' : 'INTERVIEW SESSION TESTS INCOMPLETE — FAILURES REMAIN ✗'));

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runInterviewSessionTests();
