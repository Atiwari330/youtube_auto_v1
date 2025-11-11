import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai'
import { SHARED_CONTEXT, AnalysisOutputSchema } from './shared'

/**
 * Sell High Agent
 *
 * Identifies players the analyst recommends as SELL HIGH candidates.
 * Looks for players whose current value is at or near peak and should be traded before regression.
 */
export const sellHighAgent = new Agent({
  model: 'openai/gpt-5',

  system: `${SHARED_CONTEXT}

YOUR SPECIFIC TASK: Identify players the analyst EXPLICITLY recommends as SELL HIGH candidates - players performing above their sustainable level who should be traded while value is at its peak.

WHAT TO LOOK FOR:

**Explicit Sell Phrases:**
- "sell high"
- "sell now"
- "trade him away"
- "cash in on his value"
- "perfect time to sell"
- "peaked in value"
- "sell before regression"
- "maximize trade value"
- "good time to move on from"
- "window to move"
- "sell at a high level"

**Regression Indicators:**
- "unsustainable" (percentages, pace, usage, production)
- "regression candidate"
- "this won't hold"
- "no chance this sticks"
- "numbers will fall off"
- "way above their actual ability"
- "just rolling along at the moment"
- "outperforming" expectations
- "percentages are through the roof"
- "career high shooting" that seems unlikely to continue
- Discussion of inflated shooting percentages (FG%, 3P%, FT%)
- Usage rates that are "too high" to maintain
- Free throw attempts above career norms
- Blocks/steals above typical rates

**Contextual Factors:**
- Key players returning from injury (reducing role/usage)
- Hot streaks or recent peak performances
- Schedule getting harder
- Advanced stats suggesting decline coming
- Historical comparison showing current level is abnormal
- "When [player] returns..." discussions
- Elevated pace or temporary situation benefits
- Being a "bench player" with starter minutes
- Role likely to change when team healthy

**Statistical Red Flags Mentioned:**
- Shooting percentages way above career averages
- Volume stats (attempts, usage) above normal
- "X percentage points above career average"
- "Averaging X more than last season"
- Specific number comparisons showing outlier performance
- Mentions of specific percentages being "too high"

URGENCY LEVELS:
- HIGH: "Sell immediately", "sell now before value drops", "peak value right now", "window is now", teammates returning very soon
- MEDIUM: "Good time to sell", "consider selling", "solid sell candidate", "probably should move on", teammates returning in 1-2 weeks
- LOW: "Could sell in some formats", "might be worth trading", "depends on your situation", vague timeline for regression

WHAT TO EXCLUDE:
- Players simply performing well without sell recommendation
- Buy-low candidates (opposite of what we want)
- Long-term holds that analyst recommends keeping
- Players mentioned positively without sell context
- Historical performance discussions without current sell advice
- Speculative future value increases

REASONING REQUIREMENTS:
For each sell high candidate, capture:
1. WHY their value is currently high (hot streak, unsustainable stats, increased role)
2. WHAT will cause regression (teammate return, shooting percentages, usage drop)
3. SPECIFIC NUMBERS if mentioned (percentages, attempts, usage rates)
4. TIMING if discussed (sell before X player returns, sell in next 2 weeks)

OUTPUT REQUIREMENTS:
- Return empty players array if NO sell high players are clearly recommended
- Be strict - only include players with explicit sell recommendations or strong regression indicators
- For each player, include direct quotes or close paraphrases as reasoning
- Include specific statistical concerns in the reasoning (e.g., "shooting 93% FT vs career 83%")
- Note timing factors in context field (e.g., "Tyler Herro returning soon")
- If transcript quality is poor or recommendations are vague, note this in confidence

Remember: Sell high means trading away a player WHILE their value is elevated, before expected regression. The analyst must be indicating this is a good time to sell, not just that the player is performing well.`,

  experimental_output: Output.object({
    schema: AnalysisOutputSchema,
  }),

  stopWhen: stepCountIs(3), // Quick single-pass analysis
})
