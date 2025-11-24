-- ============================================================================
-- MIGRATION: 002_create_base_tables.sql
-- PURPOSE: Create foundational organizational tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(100),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON public.teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_department ON public.teams(department);

-- ============================================================================
-- 2. CREATE SHIFTS TABLE
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
-- 3. CREATE POSITIONS TABLE
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
  ('IT Specialist', 'Information Technology'),
  ('Content Creator', 'Content Creator'),
  ('Designer', 'UI/UX Designer'),
  ('Developer', 'Software Developer'),
  ('Manager', 'Department Manager')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_positions_name ON public.positions(name);

-- ============================================================================
-- 4. CREATE PROFILES TABLE (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    employment_status VARCHAR(50),
    university TEXT,
    major TEXT,
    degree VARCHAR(100),
    cv_url TEXT,
    account_status account_status_type NOT NULL DEFAULT 'PENDING',
    
    -- Organization relationships
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    
    -- Financial
    annual_leave_balance INTEGER DEFAULT 12,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shift_id ON public.profiles(shift_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_employment_status ON public.profiles(employment_status);

-- ============================================================================
-- 5. CREATE USER_ROLES TABLE (Role assignment)
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
-- 6. CREATE TEAM_LEADERS TABLE (Many-to-many: leaders to teams)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_team_leader UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_leaders_team_id ON public.team_leaders(team_id);
CREATE INDEX IF NOT EXISTS idx_team_leaders_user_id ON public.team_leaders(user_id);

-- ============================================================================
-- 7. ADD TRIGGERS FOR updated_at
-- ============================================================================

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
