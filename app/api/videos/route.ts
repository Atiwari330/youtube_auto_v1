import { NextRequest, NextResponse } from 'next/server'
import { getRecentVideos } from '@/lib/supabase'
import type { VideosListResponse } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/videos
 *
 * List recently processed videos
 *
 * Query parameters (optional):
 *   ?limit=10  // Number of videos to return (default: 10, max: 50)
 *
 * Response:
 *   {
 *     "videos": [
 *       {
 *         "id": "VIDEO_ID",
 *         "title": "Video Title",
 *         "published_at": "2025-11-02T15:00:00Z",
 *         "status": "succeeded",
 *         "duration_sec": 1234
 *       }
 *     ]
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)

    console.log(`[api/videos] Fetching ${limit} recent videos`)

    const videos = await getRecentVideos(limit)

    const response: VideosListResponse = {
      videos: videos.map(v => ({
        id: v.id,
        title: v.title,
        published_at: v.published_at,
        status: v.status,
        duration_sec: v.duration_sec,
      })),
    }

    console.log(`[api/videos] Returning ${videos.length} videos`)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[api/videos] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch videos',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
