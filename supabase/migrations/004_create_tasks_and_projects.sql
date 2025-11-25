-- ============================================================================
-- MIGRATION: 004_create_tasks_and_projects.sql
-- PURPOSE: Create task and project management tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    status project_status_type DEFAULT 'active',
    
    -- Timeline
    start_date DATE,
    end_date DATE,
    
    -- Customization
    color color_type DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT '🚀',
    
    -- Relationships
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

-- ============================================================================
-- 2. CREATE FIELDS TABLE (Columns/Board sections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Field properties
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color color_type DEFAULT 'blue',
    icon VARCHAR(50),
    position INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fields_team_id ON public.fields(team_id);
CREATE INDEX IF NOT EXISTS idx_fields_created_by ON public.fields(created_by);
CREATE INDEX IF NOT EXISTS idx_fields_position ON public.fields(position);
CREATE INDEX IF NOT EXISTS idx_fields_is_archived ON public.fields(is_archived);

-- ============================================================================
-- 3. CREATE TASK_STATUSES TABLE (Custom statuses per team)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    
    -- Status properties
    name VARCHAR(100) NOT NULL,
    label VARCHAR(100) NOT NULL,
    color color_type DEFAULT 'gray',
    position INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one status name per team
    CONSTRAINT unique_status_per_team UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_statuses_team_id ON public.task_statuses(team_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_position ON public.task_statuses(position);

-- ============================================================================
-- 4. CREATE TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Task properties
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(100) DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    
    -- Assignment and organization
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    field_id UUID REFERENCES public.fields(id) ON DELETE SET NULL,
    
    -- Customization
    color color_type DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT '🧩',
    
    -- Timeline and scheduling
    start_date DATE,
    deadline TIMESTAMPTZ,
    duration_days INTEGER DEFAULT 1,
    estimated_hours NUMERIC(8, 2),
    actual_hours NUMERIC(8, 2),
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    dependencies UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Timestamps
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_field_id ON public.tasks(field_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date);

-- ============================================================================
-- 5. CREATE TASK_COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at DESC);

-- ============================================================================
-- 6. ADD TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fields_updated_at ON public.fields;
CREATE TRIGGER update_fields_updated_at BEFORE UPDATE ON public.fields
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_statuses_updated_at ON public.task_statuses;
CREATE TRIGGER update_task_statuses_updated_at BEFORE UPDATE ON public.task_statuses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. CREATE FUNCTION TO UPDATE TASK PROGRESS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_task_progress_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update progress percentage based on status
    IF NEW.status = 'done' THEN
        NEW.progress_percentage := 100;
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at := NOW();
        END IF;
    ELSIF NEW.status = 'review' THEN
        NEW.progress_percentage := 80;
    ELSIF NEW.status = 'in_progress' THEN
        IF NEW.progress_percentage < 20 THEN
            NEW.progress_percentage := 20;
        END IF;
    ELSIF NEW.status = 'todo' THEN
        IF NEW.progress_percentage > 0 THEN
            NEW.progress_percentage := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_progress_on_status_change ON public.tasks;
CREATE TRIGGER task_progress_on_status_change BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_task_progress_on_status_change();

-- ============================================================================
-- 8. CREATE DEFAULT TASK STATUSES FOR NEW TEAMS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_default_task_statuses_for_team(p_team_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.task_statuses (team_id, name, label, color, position, is_default)
    VALUES
        (p_team_id, 'todo', 'To Do', 'gray', 0, TRUE),
        (p_team_id, 'in_progress', 'In Progress', 'blue', 1, FALSE),
        (p_team_id, 'review', 'Review', 'yellow', 2, FALSE),
        (p_team_id, 'done', 'Done', 'green', 3, FALSE)
    ON CONFLICT (team_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. CREATE DEFAULT FIELDS FOR NEW TEAMS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_default_fields_for_team(p_team_id UUID)
RETURNS void AS $$
DECLARE
    v_creator_id UUID;
BEGIN
    -- Get first user in team
    SELECT id INTO v_creator_id FROM public.profiles WHERE team_id = p_team_id LIMIT 1;
    
    IF v_creator_id IS NOT NULL THEN
        INSERT INTO public.fields (team_id, created_by, name, color, position, is_archived)
        VALUES
            (p_team_id, v_creator_id, 'To Do', 'gray', 0, FALSE),
            (p_team_id, v_creator_id, 'In Progress', 'blue', 1, FALSE),
            (p_team_id, v_creator_id, 'Review', 'yellow', 2, FALSE),
            (p_team_id, v_creator_id, 'Done', 'green', 3, FALSE)
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;
