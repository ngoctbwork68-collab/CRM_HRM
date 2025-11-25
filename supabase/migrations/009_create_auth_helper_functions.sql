-- ============================================================================
-- MIGRATION: 009_create_auth_helper_functions.sql
-- PURPOSE: Create functions to handle user signup and profile management
-- ============================================================================

-- ============================================================================
-- 1. FUNCTION TO HANDLE NEW USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile record for new user
    INSERT INTO public.profiles (
        id, 
        email, 
        first_name, 
        last_name,
        account_status
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        'PENDING'  -- New users are pending approval
    );
    
    -- Assign default staff role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff'::app_role);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. FUNCTION TO CHECK IF USER HAS ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(
    _user_id UUID,
    _role app_role
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. FUNCTION TO GET USER'S PRIMARY ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id UUID)
RETURNS app_role AS $$
DECLARE
    v_role app_role;
BEGIN
    -- Priority order: admin > hr > leader > staff > default
    SELECT role INTO v_role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY CASE 
        WHEN role = 'admin'::app_role THEN 1
        WHEN role = 'hr'::app_role THEN 2
        WHEN role = 'leader'::app_role THEN 3
        ELSE 4
    END
    LIMIT 1;
    
    RETURN COALESCE(v_role, 'staff'::app_role);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. FUNCTION TO GET USER'S TEAM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_team(_user_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT team_id FROM public.profiles WHERE id = _user_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. FUNCTION TO APPROVE USER REGISTRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_user_registration(
    p_user_id UUID,
    p_role VARCHAR(50) DEFAULT 'staff',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update account status to approved
    UPDATE public.profiles
    SET account_status = 'APPROVED'
    WHERE id = p_user_id;
    
    -- Upsert user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log the action
    PERFORM public.log_audit_event(
        auth.uid(),
        'approve_user',
        'profiles',
        p_user_id,
        jsonb_build_object('role', p_role, 'notes', p_admin_notes)
    );
    
    -- Notify user (optional)
    PERFORM public.create_notification(
        p_user_id,
        'account_approved',
        'Account Approved',
        'Your account has been approved! You can now access the system.',
        '/dashboard'
    );
    
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'User approved successfully',
        'user_id', p_user_id,
        'role', p_role
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNCTION TO REJECT USER REGISTRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_user_registration(
    p_user_id UUID,
    p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update account status to rejected
    UPDATE public.profiles
    SET account_status = 'REJECTED'
    WHERE id = p_user_id;
    
    -- Log the action
    PERFORM public.log_audit_event(
        auth.uid(),
        'reject_user',
        'profiles',
        p_user_id,
        jsonb_build_object('reason', p_rejection_reason)
    );
    
    -- Notify user
    PERFORM public.create_notification(
        p_user_id,
        'account_rejected',
        'Account Rejected',
        'Your account registration was not approved. Reason: ' || p_rejection_reason,
        '/auth/pending-approval'
    );
    
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'User rejected successfully',
        'user_id', p_user_id,
        'reason', p_rejection_reason
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION TO UPDATE USER PROFILE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_field VARCHAR(100);
    v_value TEXT;
BEGIN
    -- Validate user_id
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'User not found');
    END IF;
    
    -- Update allowed fields
    FOR v_field, v_value IN 
        SELECT key, value FROM jsonb_each_text(p_data)
    LOOP
        CASE v_field
            WHEN 'first_name' THEN UPDATE public.profiles SET first_name = v_value WHERE id = p_user_id;
            WHEN 'last_name' THEN UPDATE public.profiles SET last_name = v_value WHERE id = p_user_id;
            WHEN 'phone' THEN UPDATE public.profiles SET phone = v_value WHERE id = p_user_id;
            WHEN 'avatar_url' THEN UPDATE public.profiles SET avatar_url = v_value WHERE id = p_user_id;
            WHEN 'date_of_birth' THEN UPDATE public.profiles SET date_of_birth = v_value::DATE WHERE id = p_user_id;
            WHEN 'gender' THEN UPDATE public.profiles SET gender = v_value WHERE id = p_user_id;
            WHEN 'university' THEN UPDATE public.profiles SET university = v_value WHERE id = p_user_id;
            WHEN 'major' THEN UPDATE public.profiles SET major = v_value WHERE id = p_user_id;
            ELSE
                -- Ignore unknown fields
                NULL;
        END CASE;
    END LOOP;
    
    -- Log the update
    PERFORM public.log_audit_event(
        p_user_id,
        'update_profile',
        'profiles',
        p_user_id,
        p_data
    );
    
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Profile updated successfully',
        'user_id', p_user_id
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. FUNCTION TO ASSIGN USER TO TEAM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_user_to_team(
    p_user_id UUID,
    p_team_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validate team exists
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Team not found');
    END IF;
    
    -- Update user's team
    UPDATE public.profiles
    SET team_id = p_team_id
    WHERE id = p_user_id;
    
    -- Create default fields and statuses for team if needed
    PERFORM public.create_default_fields_for_team(p_team_id);
    PERFORM public.create_default_task_statuses_for_team(p_team_id);
    
    -- Create attendance settings if not exists
    INSERT INTO public.attendance_settings (team_id)
    VALUES (p_team_id)
    ON CONFLICT (team_id) DO NOTHING;
    
    -- Log the action
    PERFORM public.log_audit_event(
        auth.uid(),
        'assign_team',
        'profiles',
        p_user_id,
        jsonb_build_object('team_id', p_team_id::TEXT)
    );
    
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'User assigned to team successfully',
        'user_id', p_user_id,
        'team_id', p_team_id
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
