-- ============================================================================
-- REGISTRATION APPROVAL SYSTEM SETUP
-- ============================================================================
-- This SQL script sets up the registration approval workflow in Supabase
-- Run this in your Supabase SQL Editor to set up the approval system
-- ============================================================================

-- Step 1: Create ENUM type for approval status
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Step 2: Add approval columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_by UUID,
ADD COLUMN IF NOT EXISTS last_approval_request TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Create an index on approval_status for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status 
ON profiles(approval_status);

-- Step 4: Create a view for pending approvals (easier to query)
CREATE OR REPLACE VIEW pending_approvals AS
SELECT 
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.created_at,
  p.approval_status,
  p.last_approval_request,
  ur.role
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE p.approval_status = 'pending'
ORDER BY p.created_at DESC;

-- Step 5: Create function to approve user registration
CREATE OR REPLACE FUNCTION approve_user_registration(
  user_id UUID,
  approver_id UUID,
  assigned_role TEXT DEFAULT 'staff'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Update profile approval status
  UPDATE profiles
  SET 
    approval_status = 'approved',
    approved_at = CURRENT_TIMESTAMP,
    approved_by = approver_id
  WHERE id = user_id;

  -- Insert or update user role
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id, assigned_role::app_role)
  ON CONFLICT (user_id) DO UPDATE
  SET role = assigned_role::app_role;

  -- Return success with user details
  SELECT json_build_object(
    'success', true,
    'message', 'User approved successfully',
    'user_id', user_id,
    'role', assigned_role
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create function to reject user registration
CREATE OR REPLACE FUNCTION reject_user_registration(
  user_id UUID,
  rejector_id UUID,
  reason TEXT DEFAULT 'Không rõ'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Update profile with rejection details
  UPDATE profiles
  SET 
    approval_status = 'rejected',
    rejected_at = CURRENT_TIMESTAMP,
    rejected_by = rejector_id,
    rejection_reason = reason,
    last_approval_request = CURRENT_TIMESTAMP
  WHERE id = user_id;

  -- Return success response
  SELECT json_build_object(
    'success', true,
    'message', 'User rejected successfully',
    'user_id', user_id,
    'rejection_reason', reason
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create audit table for approval history
CREATE TABLE IF NOT EXISTS approval_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'approved', 'rejected', 're_applied'
  approver_id UUID REFERENCES profiles(id),
  reason TEXT,
  old_status approval_status,
  new_status approval_status,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 8: Create index on audit log for queries
CREATE INDEX IF NOT EXISTS idx_approval_audit_log_user_id 
ON approval_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_approval_audit_log_action 
ON approval_audit_log(action);

-- Step 9: RLS Policy - Only approved users can access other profile data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile regardless of approval status
CREATE POLICY "Users can see own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Admins/HR can see all profiles including pending ones
CREATE POLICY "Admins and HR can see all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr')
    )
  );

-- Policy: Only approved users can see other users' profiles
CREATE POLICY "Approved users can see other approved users" ON profiles
  FOR SELECT
  USING (
    approval_status = 'approved' 
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.approval_status = 'approved'
    )
  );

-- Step 10: Add notification trigger for approval events
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'approved', 'rejected', 'pending_admin'
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_user_id 
ON approval_notifications(user_id);

-- ============================================================================
-- MIGRATION DATA (if you have existing users without approval_status)
-- ============================================================================
-- Uncomment and run this if you want to approve all existing users:
-- UPDATE profiles 
-- SET approval_status = 'approved', 
--     approved_at = CURRENT_TIMESTAMP,
--     approved_by = (SELECT id FROM user_roles WHERE role = 'admin' LIMIT 1)
-- WHERE approval_status IS NULL;

-- ============================================================================
-- USEFUL QUERIES FOR REFERENCE
-- ============================================================================

-- View all pending approvals:
-- SELECT * FROM pending_approvals;

-- Count pending approvals:
-- SELECT COUNT(*) as pending_count FROM profiles WHERE approval_status = 'pending';

-- Get approval statistics:
-- SELECT 
--   approval_status, 
--   COUNT(*) as count 
-- FROM profiles 
-- GROUP BY approval_status;

-- Get user approval history:
-- SELECT * FROM approval_audit_log WHERE user_id = 'user-id-here' ORDER BY created_at DESC;

-- ============================================================================
-- END OF SETUP SCRIPT
-- ============================================================================
