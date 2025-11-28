-- ============================================================================
-- MIGRATION: 008_create_storage_and_documents.sql
-- PURPOSE: Configure storage buckets and document/file management
-- ============================================================================

-- ============================================================================
-- 1. CREATE STORAGE BUCKETS
-- ============================================================================

-- Avatars bucket (public - anyone can view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Documents bucket (private - requires authentication)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', FALSE)
ON CONFLICT (id) DO NOTHING;

-- CVs bucket (private - requires authentication)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-files', 'cv-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Meeting files bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-files', 'meeting-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. CREATE DOCUMENTS TABLE (metadata tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Document details
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    bucket_name VARCHAR(100) NOT NULL,
    
    -- Document type
    document_type VARCHAR(50) CHECK (document_type IN ('avatar', 'cv', 'certificate', 'contract', 'other')),
    
    -- Sharing
    is_public BOOLEAN DEFAULT FALSE,
    shared_with UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_bucket_name ON public.documents(bucket_name);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- ============================================================================
-- 3. ADD TRIGGER FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. HELPER FUNCTION TO CREATE STORAGE POLICIES
-- ============================================================================

-- Note: RLS policies for storage are created in migration 010 (RLS Policies)
-- This is just to create the bucket structure here

-- ============================================================================
-- 5. FUNCTION TO GENERATE SIGNED URLS FOR DOCUMENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_signed_document_url(
    p_bucket_name VARCHAR(100),
    p_file_path VARCHAR(500),
    p_expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
DECLARE
    v_url TEXT;
BEGIN
    -- Note: This function is a placeholder
    -- Actual signed URL generation should be done from client-side using Supabase SDK
    -- Return placeholder - actual implementation in frontend
    RETURN 'https://signed-url-placeholder.example.com/' || p_bucket_name || '/' || p_file_path;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION TO CLEANUP ORPHANED FILES (optional scheduled task)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_documents()
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER := 0;
    v_doc RECORD;
BEGIN
    -- Mark documents with deleted users for cleanup
    -- In production, you might delete or archive these
    FOR v_doc IN
        SELECT d.id FROM public.documents d
        LEFT JOIN public.profiles p ON d.user_id = p.id
        WHERE p.id IS NULL
        LIMIT 100
    LOOP
        -- Log the orphaned document (don't delete, just log)
        PERFORM public.log_audit_event(
            NULL,
            'cleanup',
            'orphaned_document',
            v_doc.id,
            jsonb_build_object('action', 'marked_for_cleanup')
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('orphaned_count', v_count, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
