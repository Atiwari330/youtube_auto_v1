-- Cleanup Script: Drop existing tables from previous attempts
-- Run this BEFORE 001_initial_schema.sql if you want a clean slate

-- Drop tables in correct order (reverse of foreign key dependencies)
DROP TABLE IF EXISTS public.transcripts CASCADE;
DROP TABLE IF EXISTS public.videos CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- Drop any indexes that might exist
DROP INDEX IF EXISTS idx_videos_published_at;
DROP INDEX IF EXISTS idx_videos_status;
DROP INDEX IF EXISTS idx_videos_created_at;

-- Optional: Drop any other tables you might have from previous attempts
-- Uncomment and add any other tables you want to remove:
-- DROP TABLE IF EXISTS public.your_old_table_name CASCADE;

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE 'Cleanup complete. Database is ready for fresh migration.';
END $$;
