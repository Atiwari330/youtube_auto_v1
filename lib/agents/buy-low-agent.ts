import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Buy Low Agent
 *
 * Identifies players the analyst recommends as BUY LOW candidates.
 * Looks for players whose current value is temporarily depressed and should be acquired before it rises.
 */
export const buyLowAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players the analyst EXPLICITLY recommends as BUY LOW candidates - players whose value has temporarily dropped below their actual ability and should be acquired before regression to the mean.

WHAT TO LOOK FOR:

**Explicit Buy Low Phrases:**
- "buy low"
- "buy now"
- "acquire him now"
- "perfect time to buy"
- "undervalued"
- "buy the dip"
- "buy before it's too late"
- "great time to acquire"
- "value has fallen"
- "buying opportunity"
- "time to pounce"
- "scoop him up"
- "good time to target in trades"

**Positive Regression Indicators:**
- "bounce back candidate"
- "due for positive regression"
- "will return to form"
- "numbers should improve"
- "should get back to"
- "trending in the right direction"
- "poised for a turnaround"
- "shooting will normalize"
- "usage will increase"
- Discussion of percentages being "too low" relative to career norms
- "Better than these numbers suggest"

**Contextual Factors:**
- Recent injury with value depressed but health improving
- Tough schedule that's about to ease up
- Decreased role that's expected to return (coach comments, situation analysis)
- Shooting slump with underlying stats suggesting improvement
- Team situation improving (trades, lineup changes)
- "When he gets healthy..."
- "Schedule gets easier after..."
- "Coach said he'll increase minutes..."
- "Role should expand when..."
- Bad recent games dragging down perception

**Statistical Opportunities Mentioned:**
- Shooting percentages way below career averages (but expected to rise)
- Usage rate temporarily down
- Minutes temporarily reduced
- Unlucky recent stretch (close games, variance)
- "X percentage points below career average"
- "Was averaging X before this slump"
- Historical comparisons showing current level is abnormally LOW
- Advanced stats showing positive underlying indicators

URGENCY LEVELS:
- HIGH: "Buy immediately", "act now before value rises", "window is closing", imminent catalyst (health return, schedule change, role increase)
- MEDIUM: "Good time to buy", "solid buy candidate", "consider targeting", catalyst in 1-2 weeks
- LOW: "Could buy in some formats", "might be worth it", "monitor the situation", vague timeline for improvement

WHAT TO EXCLUDE:
- Players simply performing poorly without buy recommendation
- Sell high candidates (opposite of what we want)
- Players analyst says are "actually bad" or "avoid"
- Players mentioned negatively without upside discussion
- Drops or cut candidates
- Historical performance discussions without current buy advice
- Speculative future concerns without positive outlook

REASONING REQUIREMENTS:
For each buy low candidate, capture:
1. WHY their value is currently low (injury, slump, tough schedule, decreased role)
2. WHAT will cause improvement (health return, schedule ease, role increase, shooting regression)
3. SPECIFIC NUMBERS if mentioned (career averages vs current, expected usage increase)
4. TIMING if discussed (buy before X player returns, buy before schedule improves)
5. UPSIDE potential (what they could return to)

OUTPUT REQUIREMENTS:
- Return empty players array if NO buy low players are clearly recommended
- Be strict - only include players with explicit buy recommendations or strong positive regression indicators
- For each player, include direct quotes or close paraphrases as reasoning
- Include specific statistical opportunities in reasoning (e.g., "shooting 35% FG vs career 45%")
- Note timing factors and catalysts in context field (e.g., "Schedule eases after next 3 games")
- If transcript quality is poor or recommendations are vague, note this in confidence

Remember: Buy low means acquiring a player WHILE their value is depressed, before expected positive regression. The analyst must be indicating this is a good time to buy, not just that the player is struggling.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3), // Quick single-pass analysis
})
