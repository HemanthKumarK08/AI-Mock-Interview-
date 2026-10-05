const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbName = process.env.DB_NAME || 'mock_interview_ai';

// Strict safety check: fail fast if configured against wrong database
if (dbName.toLowerCase() === 'online_exam' || dbName.toLowerCase().includes('intelliexam')) {
  console.error('CRITICAL SAFETY ERROR: Attempted to connect to IntelliExam database!');
  console.error('Terminating process immediately to preserve database isolation.');
  process.exit(1);
}

if (dbName !== 'mock_interview_ai') {
  console.error(`SAFETY ERROR: Expected DB_NAME to be 'mock_interview_ai', but received '${dbName}'.`);
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function verifyDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT DATABASE() AS current_db');
      const activeDb = rows[0]?.current_db;
      if (activeDb !== 'mock_interview_ai') {
        throw new Error(`Connected database mismatch: Expected 'mock_interview_ai', got '${activeDb}'`);
      }
      return { success: true, database: activeDb };
    } finally {
      connection.release();
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  pool,
  verifyDatabaseConnection
};
