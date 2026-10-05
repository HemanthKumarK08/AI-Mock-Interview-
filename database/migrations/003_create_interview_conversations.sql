-- ==============================================================================
-- Migration: 003_create_interview_conversations.sql
-- Project: MockInterviewAI
-- Database: mock_interview_ai
-- Purpose: Initialize interview_conversations table for dynamic multi-turn interviews
-- ==============================================================================

USE mock_interview_ai;

CREATE TABLE IF NOT EXISTS interview_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    turn_number INT NOT NULL,
    question TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'technical',
    question_topic VARCHAR(100) NULL,
    difficulty VARCHAR(50) NOT NULL DEFAULT 'intermediate',
    student_answer TEXT NULL,
    ai_response_metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME NULL DEFAULT NULL,
    INDEX idx_interview_conversations_session (session_id),
    UNIQUE KEY unq_session_turn (session_id, turn_number),
    CONSTRAINT fk_interview_conversations_session FOREIGN KEY (session_id) 
        REFERENCES interview_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
