-- ==============================================================================
-- Migration: 002_create_interview_sessions_tables.sql
-- Project: MockInterviewAI
-- Database: mock_interview_ai
-- Purpose: Initialize interview_sessions table for interview setup & session lifecycle
-- ==============================================================================

USE mock_interview_ai;

CREATE TABLE IF NOT EXISTS interview_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    interview_type ENUM('technical', 'hr', 'behavioral', 'mixed') NOT NULL,
    difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
    interview_mode ENUM('text', 'voice') NOT NULL,
    question_count INT NOT NULL,
    duration_minutes INT NOT NULL,
    status ENUM('created', 'ready', 'in_progress', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'ready',
    current_question_number INT NOT NULL DEFAULT 0,
    started_at DATETIME NULL DEFAULT NULL,
    completed_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_interview_sessions_user (user_id),
    INDEX idx_interview_sessions_status (status),
    INDEX idx_interview_sessions_created_at (created_at),
    CONSTRAINT fk_interview_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
