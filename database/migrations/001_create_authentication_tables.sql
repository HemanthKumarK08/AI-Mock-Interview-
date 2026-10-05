-- ==============================================================================
-- Migration: 001_create_authentication_tables.sql
-- Project: MockInterviewAI
-- Database: mock_interview_ai
-- Purpose: Initialize users, user_sessions, and candidate_profiles tables
-- ==============================================================================

USE mock_interview_ai;

-- 1. Users Table (Student/Candidate only)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student') NOT NULL DEFAULT 'student',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. User Sessions Table (Database-backed session management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token_id VARCHAR(64) NOT NULL UNIQUE,
    user_agent TEXT NULL,
    ip_address VARCHAR(45) NULL,
    expires_at DATETIME NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_sessions_user (user_id),
    INDEX idx_user_sessions_token (session_token_id),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Candidate Profiles Table (One profile per candidate)
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    phone VARCHAR(50) NULL,
    education VARCHAR(255) NULL,
    institution VARCHAR(255) NULL,
    experience_years DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
    current_role VARCHAR(255) NULL,
    target_role VARCHAR(255) NULL,
    skills TEXT NULL,
    bio TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_candidate_profiles_user (user_id),
    CONSTRAINT fk_candidate_profiles_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
