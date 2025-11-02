import { NextRequest, NextResponse } from 'next/server'
import { fetchTranscriptByVideoId, upsertAnalysis, type AgentType } from '@/lib/supabase'
import { mustRosterAgent } from '@/lib/agents/must-roster-agent'
import { watchListAgent } from '@/lib/agents/watch-list-agent'
import { dropAgent } from '@/lib/agents/drop-agent'
import { injuryReturnAgent } from '@/lib/agents/injury-return-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute timeout for AI analysis

const AGENT_MAP = {
  must_roster: mustRosterAgent,
  watch_list: watchListAgent,
  drop: dropAgent,
  injury_return: injuryReturnAgent,
} as const

const AGENT_LABELS = {
  must_roster: 'Must-Roster',
  watch_list: 'Watch List',
  drop: 'Drop Candidates',
  injury_return: 'Injury Returns',
}

/**
 * POST /api/analysis/:videoId/:agentType
 *
 * Run a specific AI agent to analyze a video transcript
 *
 * Path parameters:
 *  - videoId: YouTube video ID
 *  - agentType: One of 'must_roster', 'watch_list', 'drop', 'injury_return'
 *
 * Response:
 *   {
 *     "players": [...],
 *     "summary": "...",
 *     "confidence": "HIGH|MEDIUM|LOW",
 *     "notes": "..."
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string; agentType: string }> }
) {
  try {
    const { videoId, agentType } = await params

    // Validate agent type
    if (!Object.keys(AGENT_MAP).includes(agentType)) {
      return NextResponse.json(
        {
          error: 'Invalid agent type',
          validTypes: Object.keys(AGENT_MAP),
        },
        { status: 400 }
      )
    }

    const typedAgentType = agentType as AgentType
    const agentLabel = AGENT_LABELS[typedAgentType]

    console.log(`[api/analysis] Running ${agentLabel} agent for video ${videoId}`)

    // Fetch transcript
    const transcript = await fetchTranscriptByVideoId(videoId)

    if (!transcript) {
      console.error(`[api/analysis] Transcript not found for video ${videoId}`)
      return NextResponse.json(
        {
          error: 'Transcript not found',
          message: 'Please transcribe the video first before running analysis',
        },
        { status: 404 }
      )
    }

    if (!transcript.text || transcript.text.length === 0) {
      console.error(`[api/analysis] Transcript is empty for video ${videoId}`)
      return NextResponse.json(
        {
          error: 'Empty transcript',
          message: 'The transcript text is empty',
        },
        { status: 400 }
      )
    }

    // Select the appropriate agent
    const agent = AGENT_MAP[typedAgentType]

    console.log(`[api/analysis] Analyzing ${transcript.text.length} characters with ${agentLabel} agent`)

    // Run the AI agent
    const startTime = Date.now()

    const result = await agent.generate({
      prompt: `Analyze this fantasy basketball video transcript:\n\n${transcript.text}`,
    })

    const analysisTime = Date.now() - startTime

    console.log(
      `[api/analysis] ${agentLabel} analysis complete in ${analysisTime}ms:`,
      `${result.experimental_output.players.length} players,`,
      `confidence: ${result.experimental_output.confidence}`
    )

    // Store the analysis result
    await upsertAnalysis({
      video_id: videoId,
      agent_type: typedAgentType,
      players: result.experimental_output.players,
      summary: result.experimental_output.summary,
      confidence: result.experimental_output.confidence,
      raw_response: result.text,
      notes: result.experimental_output.notes,
    })

    console.log(`[api/analysis] ${agentLabel} analysis stored for video ${videoId}`)

    // Return the analysis output
    return NextResponse.json({
      success: true,
      agent_type: typedAgentType,
      agent_label: agentLabel,
      analysis: result.experimental_output,
      meta: {
        video_id: videoId,
        transcript_length: transcript.text.length,
        analysis_time_ms: analysisTime,
      },
    })
  } catch (error) {
    console.error('[api/analysis] Error:', error)

    return NextResponse.json(
      {
        error: 'Analysis failed',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
