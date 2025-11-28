PS D:\CRM\CRM_HRM> supabase db push --include-all
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 011_fix_leave_profile_fk.sql
 • 20251117145800_cv_upload_and_notifications_fix.sql
 • 20251118214650_add_education_and_gender.sql

 [Y/n] Applying migration 011_fix_leave_profile_fk.sql...
Applying migration 20251117145800_cv_upload_and_notifications_fix.sql...
NOTICE (42701): column "cv_url" of relation "profiles" already exists, skipping
ERROR: policy "Users can upload their own CV" for table "objects" already exists (SQLSTATE 42710)
At statement: 2
--------------------------------------------------------------------------------
-- BƯỚC 3: THIẾT LẬP RLS CHO BUCKET 'documents' (CVs)
--------------------------------------------------------------------------------

-- 3.1 Cho phép người dùng tải lên/ghi đè CV của chính họ
-- Ràng buộc: bucket_id = 'documents' và tên file bắt đầu bằng UID của user
CREATE OR REPLACE POLICY "Users can upload their own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  )
Try rerunning the command with --debug to troubleshoot the error.
