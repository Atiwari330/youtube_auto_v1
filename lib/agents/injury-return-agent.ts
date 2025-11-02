import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Injury Return Agent
 *
 * Identifies players returning from injury or expected to return soon.
 * Focuses on actionable injury return timelines and fantasy implications.
 */
export const injuryReturnAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players who are RETURNING FROM INJURY or expected to return soon with fantasy relevance.

WHAT TO LOOK FOR:
Look for phrases like:
- "returning from injury"
- "back from IL"
- "activated off injured list"
- "cleared to play"
- "expected back next week"
- "returning soon"
- "coming back from [injury]"
- "back in the lineup"
- "return timeline"
- "practicing again"
- "progressing well"
- "targeting [date] return"

INJURY STATUSES:
- Returned: Already playing again
- Imminent: Expected back within days
- Short-term: Expected back within 1-2 weeks
- Medium-term: Expected back within 2-4 weeks
- Long-term: Expected back 4+ weeks (only include if specifically mentioned as relevant)

URGENCY LEVELS:
- HIGH: Already returned or returning within days, high fantasy value
- MEDIUM: Returning within 1-2 weeks, good fantasy value
- LOW: Longer timeline or uncertain fantasy value upon return

KEY INFORMATION TO CAPTURE:
- Specific return timeline if mentioned (e.g., "targeting Friday")
- Injury type if mentioned (e.g., "ankle sprain", "hamstring")
- Expected minutes restriction or ramp-up period
- Fantasy impact of their return (helps or hurts other players)
- Analyst's recommendation (add now, wait, monitor, etc.)

WHAT TO EXCLUDE:
- Brief mentions of past injuries without return info
- Players dealing with new injuries (not returning)
- Injury concerns without return timeline
- Load management that's not injury-related

CONTEXT TO INCLUDE:
- How return affects their fantasy value
- How return affects other players' value
- Whether analyst recommends adding before or after return
- Any risk factors mentioned (re-injury risk, minutes cap, etc.)

OUTPUT REQUIREMENTS:
- Focus on players with actionable return timelines
- Include context about fantasy impact of return
- Note if analyst recommends stashing before return
- Be clear about return timeline certainty (confirmed vs. estimated)
- Return empty if no injury returns are discussed

Remember: Focus on returns that have fantasy implications, not just injury news.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3),
})
