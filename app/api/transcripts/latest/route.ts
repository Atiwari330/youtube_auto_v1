import { NextResponse } from 'next/server'
import { fetchLatestTranscript } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/transcripts/latest
 *
 * Fetch the most recent successful transcript
 *
 * Response:
 *   {
 *     "video_id": "VIDEO_ID",
 *     "title": "Video Title",
 *     "published_at": "2025-11-02T15:00:00Z",
 *     "transcript": "Full transcript text...",
 *     "segments": null
 *   }
 *
 * Returns 404 if no transcripts exist
 */
export async function GET() {
  try {
    console.log('[api/transcripts/latest] Fetching latest transcript')

    const latest = await fetchLatestTranscript()

    if (!latest) {
      return NextResponse.json(
        { error: 'No transcripts found' },
        { status: 404 }
      )
    }

    console.log(`[api/transcripts/latest] Found transcript for video ${latest.video_id}`)

    return NextResponse.json(latest)
  } catch (error) {
    console.error('[api/transcripts/latest] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch latest transcript',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
