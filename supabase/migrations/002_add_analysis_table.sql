-- Add analysis table for AI agent results
-- This table stores the output from each AI agent analysis

CREATE TABLE IF NOT EXISTS public.analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('must_roster', 'watch_list', 'drop', 'injury_return')),
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  confidence TEXT CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  raw_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(video_id, agent_type)
);

-- Create indexes for efficient queries
CREATE INDEX idx_analysis_video_id ON public.analysis(video_id);
CREATE INDEX idx_analysis_agent_type ON public.analysis(agent_type);
CREATE INDEX idx_analysis_created_at ON public.analysis(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE public.analysis IS 'Stores AI agent analysis results for video transcripts';
COMMENT ON COLUMN public.analysis.agent_type IS 'Type of analysis: must_roster, watch_list, drop, or injury_return';
COMMENT ON COLUMN public.analysis.players IS 'JSONB array of player objects with name, urgency, reasoning, etc.';
COMMENT ON COLUMN public.analysis.confidence IS 'AI confidence in the analysis: HIGH, MEDIUM, or LOW';

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_analysis_updated_at BEFORE UPDATE
    ON public.analysis FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Done!
DO $$
BEGIN
    RAISE NOTICE '✅ Analysis table created successfully';
    RAISE NOTICE '   - analysis table with player recommendations';
    RAISE NOTICE '   - Indexes on video_id, agent_type, created_at';
    RAISE NOTICE '   - Auto-updating updated_at timestamp';
    RAISE NOTICE '   ';
    RAISE NOTICE 'Run this migration in your Supabase SQL Editor!';
END $$;
