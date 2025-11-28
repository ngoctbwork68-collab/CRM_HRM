-- ============================================================================
-- MIGRATION: 007_create_user_registration_and_notifications.sql
-- PURPOSE: Create user registration approval workflow and notification system
-- ============================================================================

-- ============================================================================
-- 1. CREATE NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Notification details
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    
    -- Status
    read BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 2. CREATE AUDIT_LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB,
    
    -- Client info
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 3. CREATE PROFILE_UPDATE_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profile_update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Update details
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    
    -- Approval workflow
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_update_requests_user_id ON public.profile_update_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_status ON public.profile_update_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_reviewed_by ON public.profile_update_requests(reviewed_by);

-- ============================================================================
-- 4. FUNCTION TO CREATE NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type VARCHAR(100),
    p_title VARCHAR(255),
    p_message TEXT,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (p_user_id, p_type, p_title, p_message, p_link)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNCTION TO LOG AUDIT EVENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_user_id UUID,
    p_action VARCHAR(255),
    p_entity_type VARCHAR(100),
    p_entity_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. TRIGGER FUNCTIONS FOR NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id UUID;
    v_user_name TEXT;
    v_days_requested INT;
BEGIN
    -- Only notify on new pending requests
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        -- Get requester name
        SELECT CONCAT(first_name, ' ', last_name) INTO v_user_name
        FROM public.profiles WHERE id = NEW.user_id;
        
        v_days_requested := (NEW.end_date - NEW.start_date) + 1;
        
        -- Notify all admins and HR
        FOR v_admin_id IN 
            SELECT user_id FROM public.user_roles 
            WHERE role IN ('admin'::app_role, 'hr'::app_role)
        LOOP
            PERFORM public.create_notification(
                v_admin_id,
                'leave_request',
                'New Leave Request',
                v_user_name || ' has requested ' || v_days_requested || ' days of leave',
                '/leave'
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_name TEXT;
BEGIN
    -- Notify on new or updated assignment
    IF NEW.assignee_id IS NOT NULL AND (
        TG_OP = 'INSERT' OR 
        (TG_OP = 'UPDATE' AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id)
    ) THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO v_creator_name
        FROM public.profiles WHERE id = NEW.creator_id;
        
        PERFORM public.create_notification(
            NEW.assignee_id,
            'task_assigned',
            'New Task Assigned',
            v_creator_name || ' assigned you: ' || NEW.title,
            '/tasks'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_room_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_reviewer_id UUID;
    v_user_name TEXT;
    v_room_name VARCHAR(255);
BEGIN
    -- Notify on new pending booking
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO v_user_name
        FROM public.profiles WHERE id = NEW.user_id;
        
        SELECT name INTO v_room_name
        FROM public.meeting_rooms WHERE id = NEW.room_id;
        
        -- Notify all admins and leaders
        FOR v_reviewer_id IN 
            SELECT user_id FROM public.user_roles 
            WHERE role IN ('admin'::app_role, 'leader'::app_role)
        LOOP
            PERFORM public.create_notification(
                v_reviewer_id,
                'room_booking',
                'New Room Booking Request',
                v_user_name || ' wants to book ' || v_room_name,
                '/meeting-rooms'
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. CREATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS on_leave_request_created ON public.leave_requests;
CREATE TRIGGER on_leave_request_created
    AFTER INSERT ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_leave_request();

DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
CREATE TRIGGER on_task_assigned
    AFTER INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_task_assignment();

DROP TRIGGER IF EXISTS on_room_booking_created ON public.room_bookings;
CREATE TRIGGER on_room_booking_created
    AFTER INSERT ON public.room_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_room_booking();
