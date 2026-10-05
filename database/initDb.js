const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'mock_interview_ai';

// Strict safety check
if (dbName.toLowerCase() === 'online_exam' || dbName.toLowerCase().includes('intelliexam')) {
  console.error('CRITICAL SAFETY ERROR: Refusing to initialize against IntelliExam database.');
  process.exit(1);
}

async function initializeDatabase() {
  let serverConn = null;
  let dbConn = null;

  try {
    // 1. Connect to MySQL server
    serverConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      multipleStatements: true
    });

    // 2. Create database if it does not exist
    await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await serverConn.end();
    serverConn = null;

    // 3. Connect to target database
    dbConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      multipleStatements: true
    });

    // 4. Run all migrations in database/migrations/
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        // Split by statement or run multi-statement safely
        try {
          await dbConn.query(sqlContent);
        } catch (mErr) {
          // If already exists / duplicate column / syntax from conditional alter, continue safely
          if (
            !mErr.message.includes('already exists') &&
            !mErr.message.includes('Duplicate column') &&
            !mErr.message.includes('IF NOT EXISTS')
          ) {
            console.warn(`[Migration Notice] ${file}: ${mErr.message}`);
          }
        }
      }
    }

    // 5. Verify required tables
    const requiredTables = [
      'users',
      'user_sessions',
      'candidate_profiles',
      'interview_sessions',
      'interview_conversations',
      'answer_evaluations'
    ];

    const [rows] = await dbConn.query('SHOW TABLES');
    const existingTables = rows.map(r => Object.values(r)[0]);

    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Missing required database tables: ${missingTables.join(', ')}`);
    }

    console.log(JSON.stringify({
      success: true,
      database: dbName,
      tables: existingTables
    }));
    await dbConn.end();
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: err.message
    }));
    if (serverConn) await serverConn.end().catch(() => {});
    if (dbConn) await dbConn.end().catch(() => {});
    process.exit(1);
  }
}

initializeDatabase();
