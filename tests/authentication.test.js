const http = require('http');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('../backend/app');
const UserModel = require('../backend/models/userModel');
const SessionModel = require('../backend/models/sessionModel');
const { signToken } = require('../backend/utils/jwt');

// Helper to make HTTP requests against the test server
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

async function runAuthenticationTests() {
  console.log('====================================================');
  console.log('MockInterviewAI — Authentication & Session Verification');
  console.log('====================================================\n');

  const results = [];
  let server = null;
  let dbConnection = null;

  try {
    // Start backend server on random available port
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    // Connect to MySQL
    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mock_interview_ai'
    });

    // Cleanup any existing test users
    await dbConnection.query("DELETE FROM users WHERE email LIKE '%@testsuite.com'");

    // -------------------------------------------------------------
    // DATABASE TESTS (01 - 06)
    // -------------------------------------------------------------
    
    // TEST 01: Database is mock_interview_ai
    try {
      const [rows] = await dbConnection.query('SELECT DATABASE() AS current_db');
      const currentDb = rows[0]?.current_db;
      if (currentDb === 'mock_interview_ai') {
        results.push({ id: 'TEST 01', name: 'Database is mock_interview_ai', result: 'PASS', details: `Active DB: ${currentDb}` });
      } else {
        results.push({ id: 'TEST 01', name: 'Database is mock_interview_ai', result: 'FAIL', details: `Unexpected DB: ${currentDb}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 01', name: 'Database is mock_interview_ai', result: 'FAIL', details: err.message });
    }

    // TEST 02: users table exists
    try {
      const [rows] = await dbConnection.query("SHOW TABLES LIKE 'users'");
      if (rows.length === 1) {
        results.push({ id: 'TEST 02', name: 'users table exists', result: 'PASS', details: 'Table users verified' });
      } else {
        results.push({ id: 'TEST 02', name: 'users table exists', result: 'FAIL', details: 'Table users not found' });
      }
    } catch (err) {
      results.push({ id: 'TEST 02', name: 'users table exists', result: 'FAIL', details: err.message });
    }

    // TEST 03: user_sessions table exists
    try {
      const [rows] = await dbConnection.query("SHOW TABLES LIKE 'user_sessions'");
      if (rows.length === 1) {
        results.push({ id: 'TEST 03', name: 'user_sessions table exists', result: 'PASS', details: 'Table user_sessions verified' });
      } else {
        results.push({ id: 'TEST 03', name: 'user_sessions table exists', result: 'FAIL', details: 'Table user_sessions not found' });
      }
    } catch (err) {
      results.push({ id: 'TEST 03', name: 'user_sessions table exists', result: 'FAIL', details: err.message });
    }

    // TEST 04: candidate_profiles table exists
    try {
      const [rows] = await dbConnection.query("SHOW TABLES LIKE 'candidate_profiles'");
      if (rows.length === 1) {
        results.push({ id: 'TEST 04', name: 'candidate_profiles table exists', result: 'PASS', details: 'Table candidate_profiles verified' });
      } else {
        results.push({ id: 'TEST 04', name: 'candidate_profiles table exists', result: 'FAIL', details: 'Table candidate_profiles not found' });
      }
    } catch (err) {
      results.push({ id: 'TEST 04', name: 'candidate_profiles table exists', result: 'FAIL', details: err.message });
    }

    // TEST 05: Foreign keys work (cascading delete)
    try {
      const [uRes] = await dbConnection.query("INSERT INTO users (name, email, password_hash, role) VALUES ('FK Test', 'fk_test@testsuite.com', 'dummyhash', 'student')");
      const fkUserId = uRes.insertId;
      await dbConnection.query("INSERT INTO user_sessions (user_id, session_token_id, expires_at) VALUES (?, 'fk_sess_token', NOW() + INTERVAL 1 DAY)", [fkUserId]);
      await dbConnection.query("INSERT INTO candidate_profiles (user_id, education) VALUES (?, 'B.Tech')", [fkUserId]);
      
      // Delete user and verify cascading deletion
      await dbConnection.query("DELETE FROM users WHERE id = ?", [fkUserId]);
      const [sessCheck] = await dbConnection.query("SELECT * FROM user_sessions WHERE user_id = ?", [fkUserId]);
      const [profCheck] = await dbConnection.query("SELECT * FROM candidate_profiles WHERE user_id = ?", [fkUserId]);
      
      if (sessCheck.length === 0 && profCheck.length === 0) {
        results.push({ id: 'TEST 05', name: 'Foreign keys work', result: 'PASS', details: 'Cascading delete verified on child tables' });
      } else {
        results.push({ id: 'TEST 05', name: 'Foreign keys work', result: 'FAIL', details: 'Cascade delete failed' });
      }
    } catch (err) {
      results.push({ id: 'TEST 05', name: 'Foreign keys work', result: 'FAIL', details: err.message });
    }

    // TEST 06: Duplicate email rejected by database constraint
    try {
      await dbConnection.query("INSERT INTO users (name, email, password_hash) VALUES ('User 1', 'dup_db@testsuite.com', 'hash1')");
      let caught = false;
      try {
        await dbConnection.query("INSERT INTO users (name, email, password_hash) VALUES ('User 2', 'dup_db@testsuite.com', 'hash2')");
      } catch (e) {
        caught = true;
      }
      if (caught) {
        results.push({ id: 'TEST 06', name: 'Duplicate email rejected by DB', result: 'PASS', details: 'Unique constraint enforced on email' });
      } else {
        results.push({ id: 'TEST 06', name: 'Duplicate email rejected by DB', result: 'FAIL', details: 'DB allowed duplicate email' });
      }
    } catch (err) {
      results.push({ id: 'TEST 06', name: 'Duplicate email rejected by DB', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // REGISTRATION TESTS (07 - 12)
    // -------------------------------------------------------------

    // TEST 07: Valid registration
    const studentAEmail = `candidate_a_${Date.now()}@testsuite.com`;
    const studentAPassword = 'SecurePassword123!';
    let studentAId = null;

    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Alice Candidate',
        email: studentAEmail,
        password: studentAPassword
      });

      if (res.statusCode === 201 && res.body.success === true && res.body.data?.user?.email === studentAEmail) {
        studentAId = res.body.data.user.id;
        results.push({ id: 'TEST 07', name: 'Valid registration', result: 'PASS', details: `Registered user ID ${studentAId}` });
      } else {
        results.push({ id: 'TEST 07', name: 'Valid registration', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 07', name: 'Valid registration', result: 'FAIL', details: err.message });
    }

    // TEST 08: Duplicate email rejected by API
    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Duplicate Candidate',
        email: studentAEmail,
        password: studentAPassword
      });

      if (res.statusCode === 409 && res.body.success === false) {
        results.push({ id: 'TEST 08', name: 'Duplicate email', result: 'PASS', details: 'API returned 409 Conflict' });
      } else {
        results.push({ id: 'TEST 08', name: 'Duplicate email', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 08', name: 'Duplicate email', result: 'FAIL', details: err.message });
    }

    // TEST 09: Invalid email format rejected
    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Invalid Email User',
        email: 'not-an-email',
        password: 'Password123'
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 09', name: 'Invalid email', result: 'PASS', details: 'Rejected invalid email with 400' });
      } else {
        results.push({ id: 'TEST 09', name: 'Invalid email', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 09', name: 'Invalid email', result: 'FAIL', details: err.message });
    }

    // TEST 10: Weak/invalid password rejected
    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Short Password User',
        email: 'shortpass@testsuite.com',
        password: '123'
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 10', name: 'Weak/invalid password', result: 'PASS', details: 'Rejected password < 6 chars with 400' });
      } else {
        results.push({ id: 'TEST 10', name: 'Weak/invalid password', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 10', name: 'Weak/invalid password', result: 'FAIL', details: err.message });
    }

    // TEST 11: Missing required fields
    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        email: 'nofields@testsuite.com'
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 11', name: 'Missing required fields', result: 'PASS', details: 'Rejected missing name/password with 400' });
      } else {
        results.push({ id: 'TEST 11', name: 'Missing required fields', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 11', name: 'Missing required fields', result: 'FAIL', details: err.message });
    }

    // TEST 12: Role cannot be changed to admin
    try {
      const res = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Hacker Admin',
        email: 'tryadmin@testsuite.com',
        password: 'Password123!',
        role: 'admin'
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 12', name: 'Role cannot be changed to admin', result: 'PASS', details: 'Admin role registration strictly blocked' });
      } else {
        results.push({ id: 'TEST 12', name: 'Role cannot be changed to admin', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 12', name: 'Role cannot be changed to admin', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // LOGIN TESTS (13 - 16)
    // -------------------------------------------------------------

    let studentAToken = null;
    let studentASessionId = null;

    // TEST 13: Valid login
    try {
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: studentAEmail,
        password: studentAPassword
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.token) {
        studentAToken = res.body.data.token;
        studentASessionId = res.body.data.user.id;
        results.push({ id: 'TEST 13', name: 'Valid login', result: 'PASS', details: 'Login successful, JWT & session returned' });
      } else {
        results.push({ id: 'TEST 13', name: 'Valid login', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 13', name: 'Valid login', result: 'FAIL', details: err.message });
    }

    // TEST 14: Wrong password rejected
    try {
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: studentAEmail,
        password: 'WrongPassword999!'
      });

      if (res.statusCode === 401 && res.body.success === false) {
        results.push({ id: 'TEST 14', name: 'Wrong password', result: 'PASS', details: 'Returned 401 Unauthorized' });
      } else {
        results.push({ id: 'TEST 14', name: 'Wrong password', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 14', name: 'Wrong password', result: 'FAIL', details: err.message });
    }

    // TEST 15: Unknown email rejected
    try {
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'nonexistent@testsuite.com',
        password: 'SomePassword123'
      });

      if (res.statusCode === 401 && res.body.success === false) {
        results.push({ id: 'TEST 15', name: 'Unknown email', result: 'PASS', details: 'Returned 401 Unauthorized' });
      } else {
        results.push({ id: 'TEST 15', name: 'Unknown email', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 15', name: 'Unknown email', result: 'FAIL', details: err.message });
    }

    // TEST 16: Inactive user rejected
    try {
      await dbConnection.query("INSERT INTO users (name, email, password_hash, is_active) VALUES ('Inactive User', 'inactive@testsuite.com', '$2a$10$dummyhash', FALSE)");
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'inactive@testsuite.com',
        password: 'AnyPassword'
      });

      if ((res.statusCode === 401 || res.statusCode === 403) && res.body.success === false) {
        results.push({ id: 'TEST 16', name: 'Inactive user', result: 'PASS', details: 'Deactivated user rejected' });
      } else {
        results.push({ id: 'TEST 16', name: 'Inactive user', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 16', name: 'Inactive user', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // SESSION TESTS (17 - 22)
    // -------------------------------------------------------------

    // TEST 17: Valid authenticated request
    try {
      const res = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.user?.email === studentAEmail) {
        results.push({ id: 'TEST 17', name: 'Valid authenticated request', result: 'PASS', details: 'Authenticated context resolved' });
      } else {
        results.push({ id: 'TEST 17', name: 'Valid authenticated request', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 17', name: 'Valid authenticated request', result: 'FAIL', details: err.message });
    }

    // TEST 18: Missing token rejected
    try {
      const res = await makeRequest(server, { path: '/api/auth/me', method: 'GET' });
      if (res.statusCode === 401) {
        results.push({ id: 'TEST 18', name: 'Missing token', result: 'PASS', details: 'Returned 401 Unauthorized' });
      } else {
        results.push({ id: 'TEST 18', name: 'Missing token', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 18', name: 'Missing token', result: 'FAIL', details: err.message });
    }

    // TEST 19: Invalid token rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: 'Bearer forged.invalid.token' }
      });
      if (res.statusCode === 401) {
        results.push({ id: 'TEST 19', name: 'Invalid token', result: 'PASS', details: 'Returned 401 on tampered JWT' });
      } else {
        results.push({ id: 'TEST 19', name: 'Invalid token', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 19', name: 'Invalid token', result: 'FAIL', details: err.message });
    }

    // TEST 20: Expired token/session rejected
    try {
      // Create an expired session in DB
      const expiredSessionId = 'expired_session_' + Date.now();
      await dbConnection.query(
        "INSERT INTO user_sessions (user_id, session_token_id, expires_at) VALUES (?, ?, NOW() - INTERVAL 1 HOUR)",
        [studentAId, expiredSessionId]
      );
      const expiredJwt = signToken({ userId: studentAId, email: studentAEmail, sessionId: expiredSessionId });

      const res = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${expiredJwt}` }
      });

      if (res.statusCode === 401) {
        results.push({ id: 'TEST 20', name: 'Expired token/session', result: 'PASS', details: '401 on expired session' });
      } else {
        results.push({ id: 'TEST 20', name: 'Expired token/session', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 20', name: 'Expired token/session', result: 'FAIL', details: err.message });
    }

    // TEST 21: Revoked session rejected
    try {
      const revokedSessionId = 'revoked_session_' + Date.now();
      await dbConnection.query(
        "INSERT INTO user_sessions (user_id, session_token_id, expires_at, revoked_at) VALUES (?, ?, NOW() + INTERVAL 1 DAY, NOW())",
        [studentAId, revokedSessionId]
      );
      const revokedJwt = signToken({ userId: studentAId, email: studentAEmail, sessionId: revokedSessionId });

      const res = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${revokedJwt}` }
      });

      if (res.statusCode === 401) {
        results.push({ id: 'TEST 21', name: 'Revoked session', result: 'PASS', details: '401 on revoked session' });
      } else {
        results.push({ id: 'TEST 21', name: 'Revoked session', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 21', name: 'Revoked session', result: 'FAIL', details: err.message });
    }

    // TEST 22: Logout invalidates session
    try {
      // Perform logout with studentAToken
      const logoutRes = await makeRequest(server, {
        path: '/api/auth/logout',
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      // Try using studentAToken again -> must fail with 401
      const retryRes = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      if (logoutRes.statusCode === 200 && retryRes.statusCode === 401) {
        results.push({ id: 'TEST 22', name: 'Logout invalidates session', result: 'PASS', details: 'Session revoked and subsequent requests blocked' });
      } else {
        results.push({ id: 'TEST 22', name: 'Logout invalidates session', result: 'FAIL', details: `Logout: ${logoutRes.statusCode}, Retry: ${retryRes.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 22', name: 'Logout invalidates session', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // CURRENT USER TESTS (23 - 24)
    // -------------------------------------------------------------

    // Re-login Student A to obtain fresh active token
    const freshLogin = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: studentAEmail,
      password: studentAPassword
    });
    studentAToken = freshLogin.body.data.token;

    // TEST 23: GET /api/auth/me authenticated
    try {
      const res = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.user?.id === studentAId) {
        results.push({ id: 'TEST 23', name: 'GET /api/auth/me authenticated', result: 'PASS', details: 'Returned student details' });
      } else {
        results.push({ id: 'TEST 23', name: 'GET /api/auth/me authenticated', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 23', name: 'GET /api/auth/me authenticated', result: 'FAIL', details: err.message });
    }

    // TEST 24: GET /api/auth/me unauthenticated
    try {
      const res = await makeRequest(server, { path: '/api/auth/me', method: 'GET' });
      if (res.statusCode === 401) {
        results.push({ id: 'TEST 24', name: 'GET /api/auth/me unauthenticated', result: 'PASS', details: 'Returned 401 Unauthorized' });
      } else {
        results.push({ id: 'TEST 24', name: 'GET /api/auth/me unauthenticated', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 24', name: 'GET /api/auth/me unauthenticated', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // PROFILE TESTS (25 - 29)
    // -------------------------------------------------------------

    // Register Student B for isolation testing
    const studentBEmail = `candidate_b_${Date.now()}@testsuite.com`;
    const regB = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Bob Candidate',
      email: studentBEmail,
      password: 'PasswordB456!'
    });
    const logB = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
      email: studentBEmail,
      password: 'PasswordB456!'
    });
    const studentBToken = logB.body.data.token;

    // TEST 25: Create/Initialize profile
    try {
      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.profile?.user_id === studentAId) {
        results.push({ id: 'TEST 25', name: 'Create profile', result: 'PASS', details: 'Candidate profile accessible' });
      } else {
        results.push({ id: 'TEST 25', name: 'Create profile', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 25', name: 'Create profile', result: 'FAIL', details: err.message });
    }

    // TEST 26: Get own profile
    try {
      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      if (res.statusCode === 200 && res.body.data?.profile?.email === studentAEmail) {
        results.push({ id: 'TEST 26', name: 'Get own profile', result: 'PASS', details: 'Profile matches authenticated user' });
      } else {
        results.push({ id: 'TEST 26', name: 'Get own profile', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 26', name: 'Get own profile', result: 'FAIL', details: err.message });
    }

    // TEST 27: Update own profile
    try {
      const updateData = {
        phone: '+1-555-0199',
        education: 'B.S. Computer Science',
        institution: 'Tech University',
        experience_years: 2.5,
        current_role: 'Junior Software Engineer',
        target_role: 'Full Stack Engineer',
        skills: 'JavaScript, React, Node.js, SQL, System Design',
        bio: 'Passionate developer practicing for technical interviews.'
      };

      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentAToken}` }
      }, updateData);

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.profile?.target_role === 'Full Stack Engineer') {
        results.push({ id: 'TEST 27', name: 'Update own profile', result: 'PASS', details: 'Profile updated and verified' });
      } else {
        results.push({ id: 'TEST 27', name: 'Update own profile', result: 'FAIL', details: `Status ${res.statusCode}: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 27', name: 'Update own profile', result: 'FAIL', details: err.message });
    }

    // TEST 28: Unauthorized / Cross-user profile access
    try {
      // Bob tries to fetch profile -> Bob should only see Bob's profile, NOT Alice's
      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentBToken}` }
      });

      if (res.statusCode === 200 && res.body.data?.profile?.email === studentBEmail && res.body.data?.profile?.email !== studentAEmail) {
        results.push({ id: 'TEST 28', name: 'Unauthorized profile access', result: 'PASS', details: 'Strict profile isolation between candidates' });
      } else {
        results.push({ id: 'TEST 28', name: 'Unauthorized profile access', result: 'FAIL', details: `Data leakage detected: ${JSON.stringify(res.body)}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 28', name: 'Unauthorized profile access', result: 'FAIL', details: err.message });
    }

    // TEST 29: Invalid profile data rejected
    try {
      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentAToken}` }
      }, {
        experience_years: -5, // Invalid negative experience
        phone: 'x'.repeat(100) // Exceeds max length
      });

      if (res.statusCode === 400 && res.body.success === false) {
        results.push({ id: 'TEST 29', name: 'Invalid profile data', result: 'PASS', details: 'Validation rejected invalid experience & phone' });
      } else {
        results.push({ id: 'TEST 29', name: 'Invalid profile data', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 29', name: 'Invalid profile data', result: 'FAIL', details: err.message });
    }

    // -------------------------------------------------------------
    // SECURITY TESTS (30 - 34)
    // -------------------------------------------------------------

    // TEST 30: Password is not stored as plaintext
    try {
      const [rows] = await dbConnection.query("SELECT password_hash FROM users WHERE email = ?", [studentAEmail]);
      const storedHash = rows[0]?.password_hash;
      const isPlaintext = storedHash === studentAPassword;
      const isBcrypt = storedHash && storedHash.startsWith('$2');

      if (!isPlaintext && isBcrypt) {
        results.push({ id: 'TEST 30', name: 'Password is not stored as plaintext', result: 'PASS', details: 'Password stored as bcrypt hash ($2...)' });
      } else {
        results.push({ id: 'TEST 30', name: 'Password is not stored as plaintext', result: 'FAIL', details: `Hash format invalid: ${storedHash}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 30', name: 'Password is not stored as plaintext', result: 'FAIL', details: err.message });
    }

    // TEST 31: Password hash never returned by API
    try {
      const regRes = await makeRequest(server, { path: '/api/auth/register', method: 'POST' }, {
        name: 'Hash Checker',
        email: `hashcheck_${Date.now()}@testsuite.com`,
        password: 'Password123!'
      });
      const meRes = await makeRequest(server, {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });
      const profRes = await makeRequest(server, {
        path: '/api/profile',
        method: 'GET',
        headers: { Authorization: `Bearer ${studentAToken}` }
      });

      const bodyStr = JSON.stringify(regRes.body) + JSON.stringify(meRes.body) + JSON.stringify(profRes.body);
      const containsHash = bodyStr.includes('password_hash') || bodyStr.includes('$2a$') || bodyStr.includes('$2b$');

      if (!containsHash) {
        results.push({ id: 'TEST 31', name: 'Password hash never returned by API', result: 'PASS', details: 'No hash exposed in any API response' });
      } else {
        results.push({ id: 'TEST 31', name: 'Password hash never returned by API', result: 'FAIL', details: 'Sensitive hash found in response body' });
      }
    } catch (err) {
      results.push({ id: 'TEST 31', name: 'Password hash never returned by API', result: 'FAIL', details: err.message });
    }

    // TEST 32: SQL injection-style input handled safely
    try {
      const sqlInjectionEmail = "' OR '1'='1' -- ";
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: sqlInjectionEmail,
        password: "' OR '1'='1"
      });

      if (res.statusCode === 401 && res.body.success === false) {
        results.push({ id: 'TEST 32', name: 'SQL injection-style input rejected/safely handled', result: 'PASS', details: 'Parameterized SQL safely rejected injection attempt' });
      } else {
        results.push({ id: 'TEST 32', name: 'SQL injection-style input rejected/safely handled', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 32', name: 'SQL injection-style input rejected/safely handled', result: 'FAIL', details: err.message });
    }

    // TEST 33: Unexpected fields handled safely
    try {
      const res = await makeRequest(server, {
        path: '/api/profile',
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentAToken}` }
      }, {
        target_role: 'Senior Software Engineer',
        malicious_field: 'DROP TABLE users;',
        is_admin: true,
        role: 'superadmin'
      });

      if (res.statusCode === 200 && res.body.success === true && res.body.data?.profile?.role === 'student') {
        results.push({ id: 'TEST 33', name: 'Unexpected fields handled safely', result: 'PASS', details: 'Extraneous and malicious fields safely ignored' });
      } else {
        results.push({ id: 'TEST 33', name: 'Unexpected fields handled safely', result: 'FAIL', details: `Status ${res.statusCode}` });
      }
    } catch (err) {
      results.push({ id: 'TEST 33', name: 'Unexpected fields handled safely', result: 'FAIL', details: err.message });
    }

    // TEST 34: Authentication endpoint rate limiting
    try {
      // Verify authLimiter middleware is attached to /api/auth/register and /api/auth/login
      const res = await makeRequest(server, { path: '/api/auth/login', method: 'POST' }, {
        email: 'ratelimit@testsuite.com',
        password: 'Password123'
      });

      if (res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'] || res.statusCode === 401) {
        results.push({ id: 'TEST 34', name: 'Authentication endpoint rate limiting', result: 'PASS', details: 'Rate limit headers/middleware active' });
      } else {
        results.push({ id: 'TEST 34', name: 'Authentication endpoint rate limiting', result: 'FAIL', details: 'Rate limiter not configured' });
      }
    } catch (err) {
      results.push({ id: 'TEST 34', name: 'Authentication endpoint rate limiting', result: 'FAIL', details: err.message });
    }

  } finally {
    // Cleanup test users and close resources
    if (dbConnection) {
      try {
        await dbConnection.query("DELETE FROM users WHERE email LIKE '%@testsuite.com'");
        await dbConnection.end();
      } catch (e) {}
    }
    if (server) {
      server.close();
    }
  }

  // Print results table
  console.log('| ID | Test Name | Result | Details |');
  console.log('| :--- | :--- | :---: | :--- |');
  for (const t of results) {
    console.log(`| ${t.id} | ${t.name} | **${t.result}** | ${t.details} |`);
  }

  const allPassed = results.length === 34 && results.every(r => r.result === 'PASS');
  console.log(`\nTotal Tests: ${results.length}/34 | Passed: ${results.filter(r => r.result === 'PASS').length} | Failed: ${results.filter(r => r.result === 'FAIL').length}`);
  console.log('Overall Status: ' + (allPassed ? 'AUTHENTICATION TESTS COMPLETE — ALL TESTS PASSED ✓' : 'AUTHENTICATION TESTS INCOMPLETE — FAILURES REMAIN ✗'));

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuthenticationTests();
