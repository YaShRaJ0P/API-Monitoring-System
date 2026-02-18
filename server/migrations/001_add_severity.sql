-- Migration: Add severity columns to alert tables
-- Run this BEFORE starting the server after Phase 2 updates.

-- Add severity to alert rules
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'warning';

-- Add severity to alert history
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'warning';
