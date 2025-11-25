# 📚 Supabase Migrations Guide

## Mục lục
1. [Tổng Quan Về Migrations](#tổng-quan)
2. [Cập Nhật Migrations Mới](#cập-nhật-migrations)
3. [Nhận Diện Xung Đột](#nhận-diện-xung-đột)
4. [Giải Quyết Xung Đột](#giải-quyết-xung-đột)
5. [Kiểm Tra Trạng Thái](#kiểm-tra-trạng-thái)
6. [Danh Sách Migrations Hiện Tại](#danh-sách-migrations)

---

## 🎯 Tổng Quan Về Migrations

### Migrations Mới Được Thêm (Chưa Deploy)
1. **20251127_update_payroll_rls_policies.sql** - RLS policies cho module Payroll
   - Cập nhật policies cho bảng `salaries`
   - Thêm 3 policies: Own Data, Admin/HR, Team/Leader access

### Migrations Đã Tồn Tại
- 20251106014315... - App roles enum + user_roles table
- 20251110021336... - Salaries table + initial RLS
- 20251120_comprehensive_hrm_schema.sql - Comprehensive HRM schema
- 20251121_expand_roles_and_add_hr.sql - HR role + salary policy updates
- Và các migrations khác...

---

## 🚀 Cập Nhật Migrations Mới

### Bước 1: Kiểm Tra Migrations Chưa Được Deploy

```bash
# Xem danh sách migrations chưa được apply
supabase migration list --linked

# Output sẽ hiển thị:
# ✓ 20251106014315_dbec92f9-c3c1-4764-8f6f-820774dbdf1e.sql
# ✓ 20251110021336_6a5c5b02-28a8-4818-a43f-003ed3a4a252.sql
# ✗ 20251127_update_payroll_rls_policies.sql (chưa deploy)
```

### Bước 2: Push Migrations Lên Supabase

**Phương Pháp 1: Qua CLI (Recommended)**
```bash
# Kiểm tra migrations sẵn sàng
supabase migration list --linked

# Push tất cả migrations chưa deploy
supabase migration push --linked

# Nếu gặp lỗi, xem chi tiết:
supabase migration list --linked --verbose
```

**Phương Pháp 2: Manual - Qua Supabase Dashboard**
1. Đăng nhập vào [supabase.com](https://supabase.com)
2. Chọn project của bạn
3. Vào **SQL Editor** → **New query**
4. Copy & paste nội dung file `.sql` migration
5. Click **Run** để execute

**Phương Pháp 3: Reset Local Database (Development)**
```bash
# Xóa toàn bộ local DB và apply lại từ đầu
supabase db reset

# Lệnh này sẽ:
# - Drop toàn bộ schemas
# - Re-apply tất cả migrations theo thứ tự
# - Seed data (nếu có)
```

### Bước 3: Xác Nhận Deploy Thành Công

```bash
# Kiểm tra toàn bộ migrations được apply
supabase migration list --linked

# Output mong muốn:
# ✓ 20251106014315_dbec92f9-c3c1-4764-8f6f-820774dbdf1e.sql
# ✓ 20251127_update_payroll_rls_policies.sql

# Kiểm tra RLS policies trên salaries table
supabase db queries --linked "SELECT * FROM pg_policies WHERE tablename = 'salaries';"
```

---

## ⚠️ Nhận Diện Xung Đột

### Xung Đột Xảy Ra Khi Nào?

**Scenario 1: Migrations Có Cùng Tên**
```bash
# Lỗi:
# Error: Migration 20251127_update_payroll_rls_policies.sql already exists
```
→ Đổi tên file migration (thêm timestamp khác)

**Scenario 2: Policies Bị Định Nghĩa Lặp Lại**
```sql
-- Error during migration:
-- ERROR: policy "Users can view own salary" for table "salaries" already exists
```
→ Cần DROP policy cũ trước khi CREATE policy mới

**Scenario 3: Constraint Conflict (Foreign Key / Unique)**
```bash
# Error:
# ERROR: insert or update on table "profiles" violates foreign key constraint
```
→ Dữ liệu cũ không tuân theo schema mới

**Scenario 4: Column Type Mismatch**
```sql
-- Error:
-- ERROR: cannot cast type integer to uuid
```
→ Cần migrate data dùng `CAST` hoặc helper function

### Các Dấu Hiệu Cảnh Báo

1. **Terminal Output Có Chữ "ERROR"**
   ```bash
   supabase migration push --linked
   # ❌ Error: [SQLSTATE 42701] duplicate key value violates unique constraint "policies_unique"
   ```

2. **Supabase Dashboard Hiển Thị**
   - Vào **Database** → **Public** → **Tables**
   - Nếu table bị "red" hoặc missing → có lỗi schema

3. **RLS Policies Bị Duplicate**
   ```sql
   -- Chạy query này ở SQL Editor:
   SELECT policyname, tablename, permissive FROM pg_policies 
   WHERE tablename = 'salaries' 
   ORDER BY policyname;
   
   -- Nếu thấy cùng policy 2 lần → CONFLICT
   ```

4. **Migration File Bị Truncate**
   - Nếu file `.sql` có size 0 bytes → migration chưa được viết đúng

---

## 🔧 Giải Quyết Xung Đột

### Cách 1: Drop & Recreate Policies

**Khi Policy Bị Duplicate:**
```sql
-- Step 1: Drop policies cũ
DROP POLICY IF EXISTS "Users can view own salary" ON public.salaries;
DROP POLICY IF EXISTS "Admins and HR can manage salaries" ON public.salaries;
DROP POLICY IF EXISTS "Leaders can view team member salaries" ON public.salaries;

-- Step 2: Create policies mới
CREATE POLICY "Users can view own salary" ON public.salaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins and HR can manage salaries" ON public.salaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
  );

CREATE POLICY "Leaders can view team member salaries" ON public.salaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_leaders tl
      INNER JOIN public.profiles p ON p.id = user_id
      WHERE tl.user_id = auth.uid() AND tl.team_id = p.team_id
    )
  );

-- Step 3: Verify policies
SELECT policyname, tablename FROM pg_policies WHERE tablename = 'salaries';
```

### Cách 2: Thêm IF NOT EXISTS Checks

**Khi Data Migration Bị Conflict:**
```sql
-- Safe approach - Check trước khi alter
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'salaries' AND column_name = 'payment_status') THEN
        ALTER TABLE public.salaries ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;
```

### Cách 3: Rollback Migration

**Khi cần quay lại trạng thái trước:**
```bash
# 1. Reset local database (DEV ONLY)
supabase db reset

# 2. Hoặc manually drop migrations
# - Xóa file migration khỏi supabase/migrations/
# - Chạy: supabase migration push --linked

# 3. Trên Supabase Dashboard
# - Vào Settings → Database → Backups
# - Restore từ backup cũ (nếu cần)
```

---

## 📊 Kiểm Tra Trạng Thái

### Danh Sách Migrations

```bash
# 1. Xem migrations local
ls -la supabase/migrations/code/supabase/migrations/

# Output:
# 20251106014315_dbec92f9-c3c1-4764-8f6f-820774dbdf1e.sql
# 20251110021336_6a5c5b02-28a8-4818-a43f-003ed3a4a252.sql
# 20251120_comprehensive_hrm_schema.sql
# 20251121_expand_roles_and_add_hr.sql
# 20251127_update_payroll_rls_policies.sql
```

### Verify Schema Trên Supabase

```bash
# Kiểm tra tables
supabase db queries --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"

# Kiểm tra RLS status
supabase db queries --linked "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"

# Kiểm tra app_role enum
supabase db queries --linked "SELECT enum_range(NULL::app_role);"
```

### Test RLS Policies

```bash
-- Trong Supabase SQL Editor, chạy:

-- Test 1: User can see own salary
SELECT * FROM salaries WHERE auth.uid() = user_id;

-- Test 2: Admin can see all
SELECT * FROM salaries WHERE EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
);

-- Test 3: Leaders can see team salaries
SELECT * FROM salaries WHERE EXISTS (
  SELECT 1 FROM team_leaders tl
  INNER JOIN profiles p ON p.id = user_id
  WHERE tl.user_id = auth.uid() AND tl.team_id = p.team_id
);
```

---

## 📋 Danh Sách Migrations Hiện Tại

### Applied Migrations ✓
| Migration | Mô Tả | Trạng Thái |
|-----------|-------|-----------|
| 20251106014315... | App roles enum + user_roles table | ✓ Deployed |
| 20251110021336... | Salaries table + RLS | ✓ Deployed |
| 20251120_comprehensive_hrm_schema.sql | HRM schema (teams, positions, projects) | ✓ Deployed |
| 20251121_expand_roles_and_add_hr.sql | HR role + salary policies update | ✓ Deployed |
| 20251125_add_reports_and_meetings.sql | Reports + meetings tables | ✓ Deployed |
| Các migrations khác | ... | ✓ Deployed |

### Pending Migrations (Cần Deploy)
| Migration | Mô Tả | Status |
|-----------|-------|--------|
| 20251127_update_payroll_rls_policies.sql | Updated payroll RLS policies (Own Data + Team + Admin/HR) | ⏳ Pending |

### Cách Deploy Pending Migrations

```bash
# 1. Kiểm tra status
supabase migration list --linked

# 2. Push lên Supabase
supabase migration push --linked

# 3. Verify thành công
supabase db queries --linked "SELECT migration FROM schema_migrations ORDER BY migration DESC LIMIT 1;"
```

---

## ⚡ Quick Commands Reference

```bash
# Start Supabase local development
supabase start

# Stop Supabase
supabase stop

# Reset database (DEV ONLY)
supabase db reset

# Create new migration
supabase migration new my_migration_name

# List migrations
supabase migration list --linked

# Push migrations to production
supabase migration push --linked

# Check database status
supabase db queries --linked "SELECT version();"

# View logs
supabase functions list --linked
supabase logs --linked
```

---

## 🆘 Troubleshooting

### Error: "Migration already exists"
```bash
# Solution: Đổi tên migration file
mv supabase/migrations/code/supabase/migrations/20251127_update_payroll_rls_policies.sql \
   supabase/migrations/code/supabase/migrations/20251128_update_payroll_rls_policies.sql
```

### Error: "Policy already exists"
```bash
# Solution: Thêm IF NOT EXISTS hoặc DROP trước CREATE
-- Trong .sql migration file:
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name ...
```

### Error: "Foreign key constraint violated"
```bash
# Solution: Kiểm tra data integrity
SELECT * FROM profiles WHERE team_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM teams WHERE teams.id = profiles.team_id);

-- Nếu có rows, fix data hoặc disable constraint
```

### Error: "Column type mismatch"
```bash
-- Solution: Sử dụng CAST hoặc migration helper
ALTER TABLE table_name 
ALTER COLUMN column_name TYPE new_type USING column_name::new_type;
```

---

## 📞 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **SQL Migrations**: https://supabase.com/docs/guides/cli/managing-schemas
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
- **Migrations Reference**: https://supabase.com/docs/reference/cli/supabase-migration-list

---

**Last Updated**: 2025-01-27
**Version**: 1.0
