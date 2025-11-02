import { z } from 'zod'

/**
 * Shared context for all AI agents analyzing fantasy basketball transcripts
 *
 * This context handles:
 * - Australian accent transcription quirks
 * - Conservative player identification
 * - Team name uncertainty
 */
export const SHARED_CONTEXT = `
IMPORTANT TRANSCRIPTION NOTES:
- This transcript was generated from speech with an Australian accent
- Player names may be phonetically transcribed (e.g., "Andre Drummond" might be "Andrew Drummond")
- Team names may be unclear or incorrectly transcribed
- Do NOT try to guess or assume which team a player is on unless explicitly stated
- If a player name is unclear or garbled, report EXACTLY what the transcript says
- Only include a player if you are confident about the name from the transcript

GENERAL RULES:
- Be conservative - only include players with clear mentions
- If you cannot determine the actual player name with confidence, skip it entirely
- Do not invent or assume information not explicitly in the transcript
- Focus on explicit recommendations from the analyst
- Cite reasoning directly from transcript quotes when possible
`

/**
 * Player schema used across all agents
 */
export const PlayerSchema = z.object({
  name: z.string().describe('Player name exactly as transcribed (do not correct or guess spelling)'),
  team: z.string().optional().describe('Only include if explicitly mentioned in transcript'),
  position: z.string().optional().describe('Only include if explicitly mentioned (e.g., PG, SG, SF, PF, C)'),
  urgency: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('How urgent this recommendation is'),
  reasoning: z.string().describe('Exact quote or close paraphrase from transcript explaining the recommendation'),
  roster_percentage: z.number().optional().describe('Only if rostered % is explicitly mentioned (0-100)'),
  context: z.string().optional().describe('Additional context like injury status, recent games, schedule, etc.'),
})

/**
 * Output schema used by all agents
 */
export const AnalysisOutputSchema = z.object({
  players: z.array(PlayerSchema).describe('Array of players matching the agent\'s criteria'),
  summary: z.string().describe('Brief 2-3 sentence summary of key findings'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Overall confidence in this analysis based on transcript clarity'),
  notes: z.string().optional().describe('Any caveats, uncertainties, or additional observations'),
})

// TypeScript types derived from Zod schemas
export type Player = z.infer<typeof PlayerSchema>
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>
