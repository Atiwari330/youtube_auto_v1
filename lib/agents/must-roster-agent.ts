import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Must-Roster Agent
 *
 * Identifies players the analyst explicitly recommends as URGENT MUST-ROSTER adds.
 * This agent looks for strong recommendations like "must add immediately", "top waiver priority", etc.
 */
export const mustRosterAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players the analyst EXPLICITLY recommends as URGENT MUST-ROSTER adds.

WHAT TO LOOK FOR:
Look for strong recommendation phrases like:
- "must add immediately"
- "top waiver priority"
- "don't wait on this guy"
- "go get him right now"
- "he needs to be rostered"
- "pick him up ASAP"
- "urgent pickup"
- "claim him off waivers"
- "he's a must-add"

URGENCY LEVELS:
- HIGH: Phrases like "must add NOW", "urgent pickup", "don't wait", "immediate add", "top priority"
- MEDIUM: Phrases like "good add", "worth rostering", "should grab", "solid pickup"
- LOW: Phrases like "consider adding", "keep in mind", "decent option"

WHAT TO EXCLUDE:
- Players only mentioned in passing without recommendation
- Players the analyst says to "watch" but not add yet
- Historical context about players (e.g., "he was good last year")
- Speculative future value without current action recommended

OUTPUT REQUIREMENTS:
- Return empty players array if NO must-roster players are clearly recommended
- Be strict - only include players with explicit add recommendations
- For each player, include direct quotes or close paraphrases as reasoning
- If transcript quality is poor or recommendations are vague, note this in confidence and notes

Remember: It's better to return an empty list than to include uncertain recommendations.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3), // No tools needed, quick single-pass analysis
})
