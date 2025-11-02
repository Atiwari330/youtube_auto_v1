import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Watch List Agent
 *
 * Identifies players the analyst recommends monitoring closely.
 * These are players with potential upside who aren't urgent adds yet.
 */
export const watchListAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players the analyst recommends MONITORING or keeping on a WATCH LIST.

WHAT TO LOOK FOR:
Look for phrases like:
- "keep an eye on"
- "monitor closely"
- "trending up"
- "could be valuable soon"
- "watch this situation"
- "interesting name to track"
- "could break out"
- "has upside if..."
- "worth watching"
- "monitor his minutes"
- "if he gets opportunity..."

URGENCY LEVELS:
- HIGH: "Watch closely", "trending up fast", "could be valuable very soon", "monitor daily"
- MEDIUM: "Keep an eye on", "interesting situation", "potential upside"
- LOW: "Worth noting", "keep in back of mind", "long-term potential"

WHAT TO EXCLUDE:
- Players recommended as immediate adds (those belong in must-roster)
- Players recommended to drop
- Generic statements about monitoring all players
- Players mentioned only as examples without specific watch recommendation

KEY SCENARIOS:
- Players getting increased opportunity (more minutes, starter out)
- Players on hot streaks that might continue
- Players returning from injury soon (but not yet back)
- Players in favorable schedule situations coming up
- Players with role changes pending

OUTPUT REQUIREMENTS:
- Include context about WHY they should be watched (injury, opportunity, trend, etc.)
- Be specific about what situation to monitor for
- Return empty if no clear watch list candidates mentioned
- Note any time-sensitive factors (e.g., "watch until starter returns")

Remember: These are NOT adds yet, but players with potential who need monitoring.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3),
})
