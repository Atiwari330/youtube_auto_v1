-- Add 'buy_low' agent type to analysis table
-- Date: 2025-11-11
-- This migration updates the CHECK CONSTRAINT to include the new 'buy_low' agent type

-- Drop the existing CHECK CONSTRAINT
ALTER TABLE public.analysis
  DROP CONSTRAINT analysis_agent_type_check;

-- Add the new CHECK CONSTRAINT with 'buy_low' included
ALTER TABLE public.analysis
  ADD CONSTRAINT analysis_agent_type_check
  CHECK (agent_type IN ('must_roster', 'watch_list', 'drop', 'injury_return', 'sell_high', 'buy_low'));

-- Update the comment to reflect the new agent type
COMMENT ON COLUMN public.analysis.agent_type IS 'Type of analysis: must_roster, watch_list, drop, injury_return, sell_high, or buy_low';

-- Done!
DO $$
BEGIN
    RAISE NOTICE '✅ Buy Low agent type added successfully';
    RAISE NOTICE '   - Updated analysis_agent_type_check constraint';
    RAISE NOTICE '   - Now allows: must_roster, watch_list, drop, injury_return, sell_high, buy_low';
    RAISE NOTICE '   ';
    RAISE NOTICE 'Run this migration in your Supabase SQL Editor!';
END $$;
