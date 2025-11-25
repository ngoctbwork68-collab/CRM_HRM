-- ============================================================================
-- MIGRATION: 010_enable_rls_and_create_policies.sql
-- PURPOSE: Enable Row Level Security (RLS) and define security policies
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_complaints ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_workload ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. TEAMS POLICIES
-- ============================================================================

-- Everyone can view teams
CREATE POLICY "Everyone can view teams" ON public.teams
    FOR SELECT USING (TRUE);

-- Admins can manage teams
CREATE POLICY "Admins can manage teams" ON public.teams
    FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 3. PROFILES POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Leaders can view team members
CREATE POLICY "Leaders can view team profiles" ON public.profiles
    FOR SELECT USING (
        public.has_role(auth.uid(), 'leader'::app_role) 
        AND team_id = public.get_user_team(auth.uid())
    );

-- Admins and HR can view all profiles
CREATE POLICY "Admins and HR can view all profiles" ON public.profiles
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin'::app_role) 
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 4. USER_ROLES POLICIES
-- ============================================================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 5. ATTENDANCE POLICIES
-- ============================================================================

-- Users can view own attendance
CREATE POLICY "Users can view own attendance" ON public.attendance_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Leaders and admins can view team attendance
CREATE POLICY "Leaders view team attendance sessions" ON public.attendance_sessions
    FOR SELECT USING (
        public.has_role(auth.uid(), 'leader'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
    );

-- Users can create own sessions
CREATE POLICY "Users can create own sessions" ON public.attendance_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own unclosed sessions
CREATE POLICY "Users can checkout own sessions" ON public.attendance_sessions
    FOR UPDATE USING (auth.uid() = user_id AND check_out IS NULL);

-- Admins/HR can manage all sessions
CREATE POLICY "Admin HR can manage all sessions" ON public.attendance_sessions
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- Daily attendance policies (similar structure)
CREATE POLICY "Users can view own daily attendance" ON public.daily_attendance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin HR can view all daily attendance" ON public.daily_attendance
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

CREATE POLICY "Admin HR can manage daily attendance" ON public.daily_attendance
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- Attendance settings - everyone can view
CREATE POLICY "Everyone can view attendance settings" ON public.attendance_settings
    FOR SELECT USING (TRUE);

-- Only admin/HR can modify settings
CREATE POLICY "Admin HR can manage attendance settings" ON public.attendance_settings
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- ============================================================================
-- 6. TASKS POLICIES
-- ============================================================================

-- Users can view tasks assigned to them or created by them
CREATE POLICY "Users can view assigned tasks" ON public.tasks
    FOR SELECT USING (
        auth.uid() = assignee_id 
        OR auth.uid() = creator_id
    );

-- Leaders can view team tasks
CREATE POLICY "Leaders can view team tasks" ON public.tasks
    FOR SELECT USING (
        public.has_role(auth.uid(), 'leader'::app_role)
        AND team_id = public.get_user_team(auth.uid())
    );

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks" ON public.tasks
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can create tasks
CREATE POLICY "Users can create tasks" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Users and admins can update tasks
CREATE POLICY "Users can update tasks" ON public.tasks
    FOR UPDATE USING (
        auth.uid() = assignee_id 
        OR auth.uid() = creator_id
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'leader'::app_role)
    );

-- ============================================================================
-- 7. LEAVE REQUESTS POLICIES
-- ============================================================================

-- Users can view own leave requests
CREATE POLICY "Users can view own leave requests" ON public.leave_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Leaders and admins can view team leave requests
CREATE POLICY "Leaders view team leave requests" ON public.leave_requests
    FOR SELECT USING (
        (public.has_role(auth.uid(), 'leader'::app_role) 
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'hr'::app_role))
    );

-- Users can create leave requests
CREATE POLICY "Users can create leave requests" ON public.leave_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their pending requests
CREATE POLICY "Users can update own pending requests" ON public.leave_requests
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending'::leave_status);

-- Admins and HR can approve/reject
CREATE POLICY "Admin HR can manage leave requests" ON public.leave_requests
    FOR UPDATE USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- ============================================================================
-- 8. SALARY POLICIES
-- ============================================================================

-- Users can view own salary
CREATE POLICY "Users can view own salary" ON public.salaries
    FOR SELECT USING (auth.uid() = user_id);

-- Admins and HR can view all
CREATE POLICY "Admin HR can view all salaries" ON public.salaries
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- Admins and HR can manage salaries
CREATE POLICY "Admin HR can manage salaries" ON public.salaries
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hr'::app_role)
    );

-- ============================================================================
-- 9. MEETING ROOMS POLICIES
-- ============================================================================

-- Everyone can view active rooms
CREATE POLICY "Everyone can view active rooms" ON public.meeting_rooms
    FOR SELECT USING (is_active = TRUE);

-- Admins can manage rooms
CREATE POLICY "Admins can manage rooms" ON public.meeting_rooms
    FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 10. ROOM BOOKINGS POLICIES
-- ============================================================================

-- Users can view own bookings
CREATE POLICY "Users can view own bookings" ON public.room_bookings
    FOR SELECT USING (auth.uid() = user_id);

-- Leaders and admins can view all
CREATE POLICY "Admin can view all bookings" ON public.room_bookings
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'leader'::app_role)
    );

-- Users can create bookings
CREATE POLICY "Users can create bookings" ON public.room_bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own bookings
CREATE POLICY "Users can update own bookings" ON public.room_bookings
    FOR UPDATE USING (auth.uid() = user_id);

-- Leaders and admins can manage bookings
CREATE POLICY "Admin can manage bookings" ON public.room_bookings
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'leader'::app_role)
    );

-- ============================================================================
-- 11. NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can view own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- System can create notifications
CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- 12. AUDIT LOGS POLICIES
-- ============================================================================

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- 13. DOCUMENTS POLICIES
-- ============================================================================

-- Users can view own documents
CREATE POLICY "Users can view own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create documents
CREATE POLICY "Users can create documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own documents
CREATE POLICY "Users can update own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete own documents
CREATE POLICY "Users can delete own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all documents" ON public.documents
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
