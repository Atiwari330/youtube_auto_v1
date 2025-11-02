import { NextRequest, NextResponse } from 'next/server'
import { listChannelUploads, durationToSeconds } from '@/lib/youtube'
import { transcribeVideo } from '@/lib/media-worker-client'
import {
  selectVideoIds,
  upsertVideo,
  insertTranscript,
  markVideoSucceeded,
  markVideoFailed,
  fetchLatestTranscript,
} from '@/lib/supabase'
import type { CheckVideosResponse } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max (can be increased for Vercel Pro)

/**
 * POST /api/check
 *
 * Main endpoint: Check for new YouTube videos and transcribe them
 *
 * Request body (optional):
 *   { "limit": 5 }  // Number of recent videos to check
 *
 * Response:
 *   {
 *     "processed": ["VIDEO_ID_1", "VIDEO_ID_2"],
 *     "latest": { video_id, title, published_at, transcript, segments }
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body for optional limit parameter
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 5, 10) // Max 10 videos per check

    console.log(`[api/check] Starting check for new videos (limit: ${limit})`)

    // Step 1: Fetch latest uploads from YouTube
    const uploads = await listChannelUploads({ maxResults: limit })

    if (uploads.length === 0) {
      console.log('[api/check] No videos found in channel')
      return NextResponse.json({
        processed: [],
        latest: null,
      })
    }

    const uploadIds = uploads.map(v => v.id)
    console.log(`[api/check] Found ${uploadIds.length} recent uploads from YouTube`)

    // Step 2: Check which videos are already processed
    const existingIds = await selectVideoIds(uploadIds)
    const newVideos = uploads.filter(v => !existingIds.includes(v.id))

    console.log(`[api/check] ${existingIds.length} already processed, ${newVideos.length} new`)

    if (newVideos.length === 0) {
      console.log('[api/check] No new videos to process')

      // Return the latest existing transcript
      const latest = await fetchLatestTranscript()

      return NextResponse.json({
        processed: [],
        latest,
      })
    }

    // Step 3: Process each new video
    const processedIds: string[] = []

    for (const video of newVideos) {
      try {
        console.log(`[api/check] Processing video ${video.id}: "${video.title}"`)

        // Convert duration to seconds
        const durationSec = video.duration ? durationToSeconds(video.duration) : null

        // Insert video with "processing" status
        await upsertVideo({
          id: video.id,
          title: video.title,
          published_at: video.publishedAt,
          duration_sec: durationSec,
          status: 'processing',
        })

        // Call Media Worker to transcribe
        const transcription = await transcribeVideo({
          videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
          langHint: process.env.LANG_HINT || 'en',
          mode: 'prerecorded',
        })

        // Store transcript
        await insertTranscript({
          video_id: video.id,
          text: transcription.text,
          language: transcription.language,
          segments: transcription.segments,
          source: 'deepgram',
        })

        // Mark video as succeeded
        await markVideoSucceeded(video.id)

        processedIds.push(video.id)

        console.log(`[api/check] Successfully processed video ${video.id}`)
      } catch (error) {
        const errorMessage = (error as Error).message
        console.error(`[api/check] Failed to process video ${video.id}:`, errorMessage)

        // Mark video as failed
        await markVideoFailed(video.id, errorMessage)
      }
    }

    // Step 4: Fetch and return the latest transcript
    const latest = await fetchLatestTranscript()

    const response: CheckVideosResponse = {
      processed: processedIds,
      latest,
    }

    console.log(`[api/check] Check complete: ${processedIds.length}/${newVideos.length} videos processed successfully`)

    return NextResponse.json(response)
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
