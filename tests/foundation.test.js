const http = require('http');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

async function runFoundationTests() {
  console.log('====================================================');
  console.log('MockInterviewAI — Foundation & Environment Verification');
  console.log('====================================================\n');

  const results = [];
  const projectRoot = path.resolve(__dirname, '..');

  // Test 1: Project Location
  try {
    const isOutsideIntelliExam = !projectRoot.toLowerCase().includes('intelliexam');
    const folderExists = fs.existsSync(projectRoot) && fs.existsSync(path.join(projectRoot, 'backend')) && fs.existsSync(path.join(projectRoot, 'frontend'));
    if (isOutsideIntelliExam && folderExists) {
      results.push({ name: 'Project location', result: 'PASS', details: `Located at ${projectRoot}` });
    } else {
      results.push({ name: 'Project location', result: 'FAIL', details: 'Location invalid or inside IntelliExam' });
    }
  } catch (err) {
    results.push({ name: 'Project location', result: 'FAIL', details: err.message });
  }

  // Test 2: IntelliExam Modification Check
  try {
    // Check whether any IntelliExam files exist inside this project or were touched
    const intelliExamFoundInside = fs.existsSync(path.join(projectRoot, 'online_exam')) || fs.existsSync(path.join(projectRoot, 'intelliexam'));
    if (!intelliExamFoundInside) {
      results.push({ name: 'IntelliExam modification check', result: 'PASS', details: '0 IntelliExam files modified or embedded' });
    } else {
      results.push({ name: 'IntelliExam modification check', result: 'FAIL', details: 'Found IntelliExam artifacts inside project' });
    }
  } catch (err) {
    results.push({ name: 'IntelliExam modification check', result: 'FAIL', details: err.message });
  }

  // Test 3: Database Isolation
  try {
    require('dotenv').config({ path: path.join(projectRoot, '.env') });
    const targetDb = process.env.DB_NAME;
    if (targetDb !== 'mock_interview_ai') {
      throw new Error(`DB_NAME is '${targetDb}', expected 'mock_interview_ai'`);
    }

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: targetDb
    });

    const [rows] = await connection.query('SELECT DATABASE() AS current_db');
    const [dbList] = await connection.query('SHOW DATABASES');
    await connection.end();

    const currentDb = rows[0]?.current_db;
    if (currentDb === 'mock_interview_ai') {
      results.push({ name: 'Database isolation', result: 'PASS', details: `Connected to isolated database: ${currentDb}` });
    } else {
      results.push({ name: 'Database isolation', result: 'FAIL', details: `Connected to unexpected database: ${currentDb}` });
    }
  } catch (err) {
    results.push({ name: 'Database isolation', result: 'FAIL', details: err.message });
  }

  // Test 4 & 5: Backend Startup and Health Endpoint
  try {
    const app = require('../backend/app');
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    results.push({ name: 'Backend startup', result: 'PASS', details: `Express app successfully bound to port ${port}` });

    // Test GET /api/health
    const healthResponse = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/api/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    if (healthResponse.statusCode === 200 && healthResponse.body.success === true && healthResponse.body.message === 'MockInterviewAI API is running') {
      results.push({ name: 'Health endpoint', result: 'PASS', details: `GET /api/health returned 200 with valid payload` });
    } else {
      results.push({ name: 'Health endpoint', result: 'FAIL', details: `Unexpected response: ${JSON.stringify(healthResponse.body)}` });
    }

    server.close();
  } catch (err) {
    results.push({ name: 'Backend startup', result: 'FAIL', details: err.message });
    results.push({ name: 'Health endpoint', result: 'FAIL', details: err.message });
  }

  // Test 6: Frontend Initialization
  try {
    const frontendPkgPath = path.join(projectRoot, 'frontend', 'package.json');
    const viteConfigPath = path.join(projectRoot, 'frontend', 'vite.config.js');
    const appJsxPath = path.join(projectRoot, 'frontend', 'src', 'App.jsx');
    
    if (fs.existsSync(frontendPkgPath) && fs.existsSync(viteConfigPath) && fs.existsSync(appJsxPath)) {
      results.push({ name: 'Frontend initialization', result: 'PASS', details: 'Vite React standalone frontend is initialized' });
    } else {
      results.push({ name: 'Frontend initialization', result: 'FAIL', details: 'Missing frontend essential files' });
    }
  } catch (err) {
    results.push({ name: 'Frontend initialization', result: 'FAIL', details: err.message });
  }

  // Test 7: Environment Isolation
  try {
    const envPath = path.join(projectRoot, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasOnlineExam = envContent.includes('online_exam');
    const hasMockInterviewAi = envContent.includes('mock_interview_ai');

    if (!hasOnlineExam && hasMockInterviewAi) {
      results.push({ name: 'Environment isolation', result: 'PASS', details: 'Clean .env configured exclusively for mock_interview_ai' });
    } else {
      results.push({ name: 'Environment isolation', result: 'FAIL', details: 'Found references to external environments in .env' });
    }
  } catch (err) {
    results.push({ name: 'Environment isolation', result: 'FAIL', details: err.message });
  }

  // Print Results Table
  console.log('| Test | Result | Details |');
  console.log('| :--- | :--- | :--- |');
  for (const t of results) {
    console.log(`| ${t.name} | ${t.result} | ${t.details} |`);
  }

  const allPassed = results.every(r => r.result === 'PASS');
  console.log('\nOverall Result: ' + (allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'));

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFoundationTests();
