-- ============================================================================
-- MIGRATION: 001_create_enums_and_extensions.sql
-- PURPOSE: Initialize PostgreSQL extensions and custom data types
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Create custom ENUM types (Sử dụng DO Block để kiểm tra sự tồn tại)
-- ============================================================================

-- App roles - used for role-based access control
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM (
            'admin', 
            'hr', 
            'leader', 
            'teacher', 
            'it', 
            'content', 
            'design', 
            'staff' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Leave request types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
        CREATE TYPE leave_type AS ENUM (
            'annual', 
            'sick', 
            'personal', 
            'unpaid' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Leave request status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
        CREATE TYPE leave_status AS ENUM (
            'pending', 
            'approved', 
            'rejected' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Task status (legacy - will be replaced by custom task_statuses table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM (
            'todo', 
            'in_progress', 
            'review', 
            'done' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Task priority
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM (
            'low', 
            'medium', 
            'high', 
            'urgent' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Room booking status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM (
            'pending', 
            'approved', 
            'rejected', 
            'cancelled' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Attendance type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_type') THEN
        CREATE TYPE attendance_type AS ENUM (
            'check_in', 
            'check_out' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Account status for user registration workflow
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status_type') THEN
        CREATE TYPE account_status_type AS ENUM (
            'PENDING', 
            'APPROVED', 
            'REJECTED' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Payment status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_type') THEN
        CREATE TYPE payment_status_type AS ENUM (
            'pending', 
            'paid', 
            'failed' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Complaint status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status_type') THEN
        CREATE TYPE complaint_status_type AS ENUM (
            'open', 
            'in_progress', 
            'resolved', 
            'rejected' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Project status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_type') THEN
        CREATE TYPE project_status_type AS ENUM (
            'planning', 
            'active', 
            'on_hold', 
            'completed', 
            'cancelled' 
        );
    END IF;
END
$$ LANGUAGE plpgsql;

-- Allowed colors for UI customization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'color_type') THEN
        CREATE TYPE color_type AS ENUM (
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
    END IF;
END
$$ LANGUAGE plpgsql;

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