import { NextRequest, NextResponse } from 'next/server'
import { fetchTranscriptByVideoId, markVideoSucceeded, markVideoFailed, insertTranscript, upsertVideo } from '@/lib/supabase'
import { transcribeVideo } from '@/lib/media-worker-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for transcription

/**
 * POST /api/transcribe/:videoId
 *
 * Transcribe a specific video by ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params

    console.log(`[api/transcribe] Starting transcription for video ${videoId}`)

    // Check if already transcribed
    const existingTranscript = await fetchTranscriptByVideoId(videoId)
    if (existingTranscript) {
      console.log(`[api/transcribe] Video ${videoId} already has transcript`)
      return NextResponse.json({
        success: true,
        message: 'Video already transcribed',
        transcript: existingTranscript,
      })
    }

    // Transcribe the video
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    try {
      // Mark as processing
      await upsertVideo({
        id: videoId,
        title: '', // Will be updated if needed
        published_at: new Date().toISOString(),
        status: 'processing',
      })

      // Call media worker
      const transcription = await transcribeVideo({
        videoUrl,
        langHint: process.env.LANG_HINT || 'en',
        mode: 'prerecorded',
      })

      // Store transcript
      await insertTranscript({
        video_id: videoId,
        text: transcription.text,
        language: transcription.language,
        segments: transcription.segments,
        source: 'deepgram',
      })

      // Mark as succeeded
      await markVideoSucceeded(videoId)

      console.log(`[api/transcribe] Successfully transcribed video ${videoId}`)

      return NextResponse.json({
        success: true,
        message: 'Transcription complete',
        transcript: {
          video_id: videoId,
          text: transcription.text,
          segments: transcription.segments,
        },
      })
    } catch (transcribeError) {
      const errorMessage = (transcribeError as Error).message
      await markVideoFailed(videoId, errorMessage)

      console.error(`[api/transcribe] Failed to transcribe video ${videoId}:`, errorMessage)

      return NextResponse.json(
        {
          success: false,
          error: 'Transcription failed',
          details: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[api/transcribe] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
