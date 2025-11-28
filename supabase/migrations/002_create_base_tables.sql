-- ============================================================================
-- MIGRATION: 002_create_base_tables.sql
-- PURPOSE: Create foundational organizational tables and fix column conflicts
-- ============================================================================

-- ============================================================================
-- 1. CREATE TEAMS TABLE (Nếu chưa tồn tại)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams(leader_id);


-- ============================================================================
-- 2. CREATE SHIFTS TABLE (Nếu chưa tồn tại)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_name ON public.shifts(name);

-- ============================================================================
-- 3. CREATE POSITIONS TABLE & SEED DATA
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.positions (name, description)
VALUES
    ('Leader', 'Team Leader'),
    ('HR Manager', 'Human Resources Manager'),
    ('Developer', 'Software Developer'),
    ('Manager', 'Department Manager')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_positions_name ON public.positions(name);

-- ============================================================================
-- 4. FIX & ALTER PROFILES TABLE (Đảm bảo cột tồn tại trước khi tạo INDEX)
-- ============================================================================

-- Thêm các cột bị thiếu vào bảng PROFILES đã tồn tại
-- Lệnh này là BẮT BUỘC để tránh lỗi 42703 (column does not exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS annual_leave_balance INTEGER DEFAULT 12;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_url TEXT;

-- BỔ SUNG CỘT GÂY LỖI: position_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_id UUID 
REFERENCES public.positions(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. CREATE INDEXES (Chỉ chạy sau khi các cột đã được đảm bảo tồn tại)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shift_id ON public.profiles(shift_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles(position_id); -- Lệnh đã gây lỗi

-- ============================================================================
-- 6. CREATE USER_ROLES TABLE (Role assignment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'staff',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_role UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================================
-- 7. ADD TRIGGERS FOR updated_at (Đã sửa lỗi DROP TRIGGER)
-- ============================================================================

-- Thêm DROP TRIGGER IF EXISTS để tránh lỗi "trigger does not exist"
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_positions_updated_at ON public.positions;
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();