-- ============================================================================
-- MIGRATION: 005_create_leave_and_salary_tables.sql
-- PURPOSE: Create leave management and salary/compensation tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE LEAVE_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Leave details
    type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    
    -- Approval workflow
    status leave_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON public.leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_end_date ON public.leave_requests(end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON public.leave_requests(approved_by);

-- ============================================================================
-- 2. CREATE SALARIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Salary components
    base_salary NUMERIC(12, 2) NOT NULL,
    allowances NUMERIC(12, 2) DEFAULT 0.00,
    bonus NUMERIC(12, 2) DEFAULT 0.00,
    deductions NUMERIC(12, 2) DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    
    -- Calculated field: net_salary = base + allowances + bonus - deductions - tax
    net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
        base_salary + allowances + bonus - deductions - tax_amount
    ) STORED,
    
    -- Pay period
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    payment_date DATE,
    payment_status payment_status_type DEFAULT 'pending',
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate salary entries for same period
    CONSTRAINT unique_salary_period UNIQUE(user_id, pay_period_start, pay_period_end)
);

CREATE INDEX IF NOT EXISTS idx_salaries_user_id ON public.salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_pay_period ON public.salaries(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_status ON public.salaries(payment_status);

-- ============================================================================
-- 3. CREATE SALARY_COMPLAINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.salary_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Complaint details
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    complaint_type VARCHAR(100) NOT NULL CHECK (
        complaint_type IN ('calculation_error', 'missing_allowance', 'bonus_issue', 'deduction_error', 'other')
    ),
    
    -- Status and resolution
    status complaint_status_type DEFAULT 'open',
    resolution_notes TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salary_complaints_user_id ON public.salary_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_complaints_status ON public.salary_complaints(status);
CREATE INDEX IF NOT EXISTS idx_salary_complaints_assigned_to ON public.salary_complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_salary_complaints_created_at ON public.salary_complaints(created_at DESC);

-- ============================================================================
-- 4. ADD TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_salaries_updated_at ON public.salaries;
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_salary_complaints_updated_at ON public.salary_complaints;
CREATE TRIGGER update_salary_complaints_updated_at BEFORE UPDATE ON public.salary_complaints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
