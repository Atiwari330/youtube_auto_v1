import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Drop Candidates Agent
 *
 * Identifies players the analyst explicitly recommends dropping or cutting.
 * This agent looks for clear sell/drop signals.
 */
export const dropAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players the analyst EXPLICITLY recommends DROPPING or CUTTING from fantasy rosters.

WHAT TO LOOK FOR:
Look for phrases like:
- "safe to drop"
- "cut candidate"
- "not worth holding"
- "better options available"
- "time to move on"
- "cut him loose"
- "drop him"
- "sell if you can"
- "he's droppable"
- "don't hold onto him"
- "cut bait"
- "free up the roster spot"

URGENCY LEVELS:
- HIGH: "Drop immediately", "cut him now", "wasting a roster spot"
- MEDIUM: "Safe to drop", "consider cutting", "probably droppable"
- LOW: "Could drop in shallow leagues", "droppable in some formats"

KEY REASONS FOR DROPS:
- Lost role/minutes (e.g., moved to bench, coach comments)
- Injury with long timeline
- Consistently poor performance with no signs of improvement
- Better streaming options available
- Schedule concerns (limited games coming up)
- Trade that hurts fantasy value

WHAT TO EXCLUDE:
- Players only mentioned as struggling (without drop recommendation)
- Players the analyst says to "hold and monitor"
- Buy-low candidates (struggling but analyst sees upside)
- Players with temporary setbacks if analyst recommends patience

IMPORTANT CONTEXT:
- Include league format if mentioned (e.g., "in 10-team leagues")
- Note if it's conditional (e.g., "drop if you need streaming spot")
- Mention any "sell high" opportunities before dropping

OUTPUT REQUIREMENTS:
- Be conservative - only include explicit drop recommendations
- Include clear reasoning from the transcript
- If analyst recommends trying to trade first, note that in context
- Return empty if no clear drop candidates recommended

Remember: Drops should be EXPLICIT recommendations, not just complaints about recent performance.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3),
})
