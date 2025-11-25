-- ============================================================================
-- MIGRATION: 001_create_enums_and_extensions.sql
-- PURPOSE: Initialize PostgreSQL extensions and custom data types
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Create custom ENUM types
-- ============================================================================

-- App roles - used for role-based access control
CREATE TYPE IF NOT EXISTS app_role AS ENUM (
  'admin',      -- Full system access
  'hr',         -- HR management access
  'leader',     -- Team leader access
  'teacher',    -- Teacher role
  'it',         -- IT specialist role
  'content',    -- Content creator role
  'design',     -- Designer role
  'staff'       -- Regular staff member (default)
);

-- Leave request types
CREATE TYPE IF NOT EXISTS leave_type AS ENUM (
  'annual',     -- Annual leave
  'sick',       -- Sick leave
  'personal',   -- Personal leave
  'unpaid'      -- Unpaid leave
);

-- Leave request status
CREATE TYPE IF NOT EXISTS leave_status AS ENUM (
  'pending',    -- Awaiting approval
  'approved',   -- Approved by manager
  'rejected'    -- Rejected by manager
);

-- Task status (legacy - will be replaced by custom task_statuses table)
CREATE TYPE IF NOT EXISTS task_status AS ENUM (
  'todo',       -- To be done
  'in_progress', -- In progress
  'review',     -- Under review
  'done'        -- Completed
);

-- Task priority
CREATE TYPE IF NOT EXISTS task_priority AS ENUM (
  'low',        -- Low priority
  'medium',     -- Medium priority
  'high',       -- High priority
  'urgent'      -- Urgent
);

-- Room booking status
CREATE TYPE IF NOT EXISTS booking_status AS ENUM (
  'pending',    -- Awaiting approval
  'approved',   -- Approved
  'rejected',   -- Rejected
  'cancelled'   -- Cancelled
);

-- Attendance type
CREATE TYPE IF NOT EXISTS attendance_type AS ENUM (
  'check_in',   -- Check-in event
  'check_out'   -- Check-out event
);

-- Account status for user registration workflow
CREATE TYPE IF NOT EXISTS account_status_type AS ENUM (
  'PENDING',    -- Awaiting approval
  'APPROVED',   -- Approved by admin
  'REJECTED'    -- Rejected by admin
);

-- Payment status
CREATE TYPE IF NOT EXISTS payment_status_type AS ENUM (
  'pending',    -- Awaiting payment
  'paid',       -- Payment completed
  'failed'      -- Payment failed
);

-- Complaint status
CREATE TYPE IF NOT EXISTS complaint_status_type AS ENUM (
  'open',       -- Open/New
  'in_progress', -- Being handled
  'resolved',   -- Resolved
  'rejected'    -- Rejected/Not valid
);

-- Project status
CREATE TYPE IF NOT EXISTS project_status_type AS ENUM (
  'planning',   -- In planning phase
  'active',     -- Active/In progress
  'on_hold',    -- On hold
  'completed',  -- Completed
  'cancelled'   -- Cancelled
);

-- Allowed colors for UI customization
CREATE TYPE IF NOT EXISTS color_type AS ENUM (
  'blue',
  'red',
  'yellow',
  'green',
  'purple',
  'pink',
  'gray',
  'orange',
  'cyan'
);

-- ============================================================================
-- Create updated_at trigger function (will be used by multiple tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
