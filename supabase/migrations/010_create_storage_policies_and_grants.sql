-- ============================================================================
-- MIGRATION: 011_create_storage_policies_and_grants.sql
-- PURPOSE: Configure storage RLS policies and database grants
-- ============================================================================

-- ============================================================================
-- 1. STORAGE POLICIES FOR AVATARS BUCKET
-- ============================================================================

-- Anyone can view avatar images
CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================================
-- 2. STORAGE POLICIES FOR CV-FILES BUCKET
-- ============================================================================

-- Users can upload their own CV
CREATE POLICY "Users can upload their own CV"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'cv-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can view their own CV
CREATE POLICY "Users can view their own CV"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'cv-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Admins and HR can view all CVs
CREATE POLICY "Admins can view all CVs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'cv-files' 
        AND (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin'::app_role, 'hr'::app_role)
            )
        )
    );

-- Users can update their own CV
CREATE POLICY "Users can update their own CV"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'cv-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own CV
CREATE POLICY "Users can delete their own CV"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'cv-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================================
-- 3. STORAGE POLICIES FOR DOCUMENTS BUCKET
-- ============================================================================

-- Users can upload documents
CREATE POLICY "Users can upload documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents' 
        AND EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'::app_role
        )
    );

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================================
-- 4. STORAGE POLICIES FOR MEETING-FILES BUCKET
-- ============================================================================

-- Users can upload meeting files
CREATE POLICY "Users can upload meeting files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'meeting-files' 
        AND auth.uid() IS NOT NULL
    );

-- Authenticated users can view meeting files
CREATE POLICY "Authenticated users can view meeting files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'meeting-files' 
        AND auth.uid() IS NOT NULL
    );

-- ============================================================================
-- 5. GRANT PERMISSIONS ON TABLES
-- ============================================================================

-- Grant SELECT/INSERT/UPDATE on main tables to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT SELECT ON public.salaries TO authenticated;
GRANT SELECT, INSERT ON public.salary_complaints TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.attendance_sessions TO authenticated;
GRANT SELECT ON public.daily_attendance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_bookings TO authenticated;
GRANT SELECT ON public.meeting_rooms TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.meeting_minutes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.action_items TO authenticated;

GRANT SELECT ON public.team_workload TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;

-- ============================================================================
-- 6. GRANT PERMISSIONS ON FUNCTIONS
-- ============================================================================

-- Grant access to helper functions
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_primary_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_checkout_unclosed_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_attendance TO authenticated;

-- Grant admin-only functions to admins
GRANT EXECUTE ON FUNCTION public.approve_user_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_to_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- ============================================================================
-- 7. ENABLE REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Allow real-time subscriptions on important tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;

-- ============================================================================
-- 8. CREATE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: User directory (approved users only)
CREATE OR REPLACE VIEW public.user_directory AS
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone,
    p.team_id,
    t.name AS team_name,
    (SELECT string_agg(role::TEXT, ', ') FROM public.user_roles WHERE user_id = p.id) AS roles
FROM public.profiles p
LEFT JOIN public.teams t ON p.team_id = t.id
WHERE p.account_status = 'APPROVED'
ORDER BY p.last_name, p.first_name;

-- View: Team members with role info
CREATE OR REPLACE VIEW public.team_members AS
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.team_id,
    t.name AS team_name,
    ur.role,
    p.account_status
FROM public.profiles p
LEFT JOIN public.teams t ON p.team_id = t.id
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.account_status = 'APPROVED'
ORDER BY t.name, p.last_name, p.first_name;

-- View: Pending approvals
CREATE OR REPLACE VIEW public.pending_user_approvals AS
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.phone,
    p.created_at,
    p.account_status
FROM public.profiles p
WHERE p.account_status IN ('PENDING', 'REJECTED')
ORDER BY p.created_at DESC;

-- View: Attendance summary (current month)
CREATE OR REPLACE VIEW public.attendance_summary_current_month AS
SELECT 
    da.user_id,
    p.first_name,
    p.last_name,
    p.email,
    COUNT(*) FILTER (WHERE da.status = 'present') AS days_present,
    COUNT(*) FILTER (WHERE da.status = 'absent') AS days_absent,
    COUNT(*) FILTER (WHERE da.status = 'late') AS days_late,
    SUM(da.total_hours) FILTER (WHERE da.status = 'present') AS total_hours,
    AVG(da.total_hours) FILTER (WHERE da.status = 'present') AS avg_hours_per_day
FROM public.daily_attendance da
JOIN public.profiles p ON da.user_id = p.id
WHERE DATE_TRUNC('month', da.attendance_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY da.user_id, p.first_name, p.last_name, p.email
ORDER BY p.last_name, p.first_name;

-- ============================================================================
-- 9. GRANT PERMISSIONS ON VIEWS
-- ============================================================================

GRANT SELECT ON public.user_directory TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT ON public.pending_user_approvals TO authenticated;
GRANT SELECT ON public.attendance_summary_current_month TO authenticated;
