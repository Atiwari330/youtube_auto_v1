import { NextRequest, NextResponse } from 'next/server'
import { fetchAnalysesByVideoId, type Analysis } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/analysis/:videoId
 *
 * Fetch all AI analyses for a specific video
 *
 * Returns an object with separate properties for each agent type:
 * {
 *   "must_roster": {...} | null,
 *   "watch_list": {...} | null,
 *   "drop": {...} | null,
 *   "injury_return": {...} | null
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params

    console.log(`[api/analysis] Fetching all analyses for video ${videoId}`)

    // Fetch all analyses for this video
    const analyses = await fetchAnalysesByVideoId(videoId)

    // Organize by agent type
    const result: Record<string, Analysis | null> = {
      must_roster: null,
      watch_list: null,
      drop: null,
      injury_return: null,
    }

    analyses.forEach(analysis => {
      result[analysis.agent_type] = analysis
    })

    console.log(
      `[api/analysis] Returning ${analyses.length} analyses for video ${videoId}:`,
      Object.keys(result).filter(k => result[k] !== null).join(', ') || 'none'
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/analysis] Error fetching analyses:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch analyses',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
