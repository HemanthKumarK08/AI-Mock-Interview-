-- Migration: 005_add_voice_metadata.sql
-- Database: mock_interview_ai
-- Description: Adds input_mode and transcription_metadata to interview_conversations for Phase 5 Voice Interview tracking

USE mock_interview_ai;

ALTER TABLE interview_conversations
  ADD COLUMN IF NOT EXISTS input_mode ENUM('text', 'voice') NOT NULL DEFAULT 'text' AFTER difficulty,
  ADD COLUMN IF NOT EXISTS transcription_metadata JSON NULL AFTER input_mode;
