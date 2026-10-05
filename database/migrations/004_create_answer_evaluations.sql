-- Migration: 004_create_answer_evaluations.sql
-- Database: mock_interview_ai
-- Description: Creates the answer_evaluations table for storing structured AI/fallback evaluations of candidate answers

USE mock_interview_ai;

CREATE TABLE IF NOT EXISTS answer_evaluations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  technical_accuracy DECIMAL(3,1) NULL,
  relevance DECIMAL(3,1) NOT NULL,
  completeness DECIMAL(3,1) NOT NULL,
  clarity DECIMAL(3,1) NOT NULL,
  communication DECIMAL(3,1) NOT NULL,
  strengths JSON NOT NULL,
  weaknesses JSON NOT NULL,
  improvement_suggestion TEXT NOT NULL,
  evaluation_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.85,
  star_situation BOOLEAN NULL,
  star_task BOOLEAN NULL,
  star_action BOOLEAN NULL,
  star_result BOOLEAN NULL,
  star_completeness DECIMAL(3,1) NULL,
  evaluation_source ENUM('gemini', 'fallback') NOT NULL DEFAULT 'gemini',
  evaluation_metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_evaluation_conversation UNIQUE (conversation_id),
  CONSTRAINT fk_evaluations_conversation FOREIGN KEY (conversation_id)
    REFERENCES interview_conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
