import { NextRequest, NextResponse } from 'next/server'
import { listChannelUploads, durationToSeconds } from '@/lib/youtube'
import {
  selectVideoIds,
  upsertVideo,
} from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max (can be increased for Vercel Pro)

/**
 * POST /api/check
 *
 * Main endpoint: Check for new YouTube videos and save metadata (does NOT auto-transcribe)
 *
 * Request body (optional):
 *   { "limit": 10 }  // Number of recent videos to fetch
 *
 * Response:
 *   {
 *     "saved": ["VIDEO_ID_1", "VIDEO_ID_2"],
 *     "videos": [{ id, title, published_at, status, ... }]
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body for optional limit parameter
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 10, 20) // Fetch up to 20 recent videos

    console.log(`[api/check] Fetching recent videos (limit: ${limit})`)

    // Step 1: Fetch latest uploads from YouTube
    const uploads = await listChannelUploads({ maxResults: limit })

    if (uploads.length === 0) {
      console.log('[api/check] No videos found in channel')
      return NextResponse.json({
        saved: [],
        videos: [],
      })
    }

    console.log(`[api/check] Found ${uploads.length} recent uploads from YouTube`)

    // Step 2: Check which videos are already in database
    const uploadIds = uploads.map(v => v.id)
    const existingIds = await selectVideoIds(uploadIds)
    const newVideos = uploads.filter(v => !existingIds.includes(v.id))

    console.log(`[api/check] ${existingIds.length} already in database, ${newVideos.length} new`)

    // Step 3: Save metadata for new videos (status: 'queued')
    const savedIds: string[] = []

    for (const video of newVideos) {
      try {
        const durationSec = video.duration ? durationToSeconds(video.duration) : null

        await upsertVideo({
          id: video.id,
          title: video.title,
          published_at: video.publishedAt,
          duration_sec: durationSec,
          status: 'queued', // Changed from 'processing' to 'queued'
        })

        savedIds.push(video.id)
        console.log(`[api/check] Saved metadata for video ${video.id}`)
      } catch (error) {
        console.error(`[api/check] Failed to save video ${video.id}:`, (error as Error).message)
      }
    }

    console.log(`[api/check] Saved ${savedIds.length} new videos to database`)

    return NextResponse.json({
      saved: savedIds,
      count: uploads.length,
      message: `Found ${uploads.length} recent videos, saved ${savedIds.length} new ones`,
    })
  } catch (error) {
    console.error('[api/check] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to check for new videos',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
