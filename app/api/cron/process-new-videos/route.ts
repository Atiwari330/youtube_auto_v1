import { NextRequest, NextResponse } from 'next/server'
import { listChannelUploads, durationToSeconds } from '@/lib/youtube'
import {
  selectVideoIds,
  upsertVideo,
  getVideosByStatus,
  fetchTranscriptByVideoId,
  insertTranscript,
  markVideoSucceeded,
  markVideoFailed,
  upsertAnalysis,
} from '@/lib/supabase'
import { transcribeVideo } from '@/lib/media-worker-client'
import { mustRosterAgent } from '@/lib/agents/must-roster-agent'
import { sendPlayerNotification, sendErrorNotification } from '@/lib/discord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for processing multiple videos

interface ProcessingSummary {
  videosChecked: number
  newVideosFound: number
  videosProcessed: number
  transcriptionsSucceeded: number
  transcriptionsFailed: number
  analysesCompleted: number
  highUrgencyPlayersFound: number
  notificationsSent: number
  errors: string[]
}

/**
 * GET /api/cron/process-new-videos
 *
 * Main automation endpoint - invoked by Vercel Cron every hour
 *
 * Workflow:
 * 1. Fetch recent videos from YouTube
 * 2. Save new videos as 'queued'
 * 3. Process all queued videos:
 *    - Transcribe via Media Worker
 *    - Run Must-Roster AI agent
 *    - Send Discord notification if HIGH urgency players found
 * 4. Return processing summary
 *
 * Security: Protected by Vercel Cron secret verification
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Verify this is a legitimate Vercel Cron request
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[cron] Unauthorized request - invalid CRON_SECRET')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('[cron] ========================================')
  console.log('[cron] Starting automated video processing')
  console.log('[cron] ========================================')

  const summary: ProcessingSummary = {
    videosChecked: 0,
    newVideosFound: 0,
    videosProcessed: 0,
    transcriptionsSucceeded: 0,
    transcriptionsFailed: 0,
    analysesCompleted: 0,
    highUrgencyPlayersFound: 0,
    notificationsSent: 0,
    errors: [],
  }

  try {
    // ========================================================================
    // STEP 1: Fetch recent videos from YouTube
    // ========================================================================
    console.log('[cron] Step 1: Fetching recent videos from YouTube...')

    let uploads: Awaited<ReturnType<typeof listChannelUploads>> = []

    try {
      uploads = await listChannelUploads({ maxResults: 10 })
      summary.videosChecked = uploads.length
      console.log(`[cron] Found ${uploads.length} recent videos`)
    } catch (error) {
      const errorMsg = `Failed to fetch videos from YouTube: ${(error as Error).message}`
      console.error('[cron]', errorMsg)
      summary.errors.push(errorMsg)

      // Send error notification but continue (maybe there are queued videos to process)
      await sendErrorNotification(errorMsg, 'YouTube API fetch failed')
    }

    // ========================================================================
    // STEP 2: Save new videos as 'queued'
    // ========================================================================
    if (uploads.length > 0) {
      console.log('[cron] Step 2: Saving new videos to database...')

      const uploadIds = uploads.map(v => v.id)
      const existingIds = await selectVideoIds(uploadIds)
      const newVideos = uploads.filter(v => !existingIds.includes(v.id))

      console.log(`[cron] ${existingIds.length} already in database, ${newVideos.length} new`)

      for (const video of newVideos) {
        try {
          const durationSec = video.duration ? durationToSeconds(video.duration) : null

          await upsertVideo({
            id: video.id,
            title: video.title,
            published_at: video.publishedAt,
            duration_sec: durationSec,
            status: 'queued',
          })

          summary.newVideosFound++
          console.log(`[cron] Queued new video: ${video.title} (${video.id})`)
        } catch (error) {
          const errorMsg = `Failed to save video ${video.id}: ${(error as Error).message}`
          console.error('[cron]', errorMsg)
          summary.errors.push(errorMsg)
        }
      }
    }

    // ========================================================================
    // STEP 3: Process all queued videos
    // ========================================================================
    console.log('[cron] Step 3: Processing queued videos...')

    const queuedVideos = await getVideosByStatus('queued')
    console.log(`[cron] Found ${queuedVideos.length} queued videos to process`)

    if (queuedVideos.length === 0) {
      console.log('[cron] No queued videos to process')
    }

    for (const video of queuedVideos) {
      summary.videosProcessed++
      console.log(`[cron] ----------------------------------------`)
      console.log(`[cron] Processing video ${summary.videosProcessed}/${queuedVideos.length}`)
      console.log(`[cron] Title: ${video.title}`)
      console.log(`[cron] ID: ${video.id}`)
      console.log(`[cron] ----------------------------------------`)

      try {
        // Check if transcript already exists (idempotent)
        const existingTranscript = await fetchTranscriptByVideoId(video.id)

        if (existingTranscript) {
          console.log(`[cron] Transcript already exists for ${video.id}, skipping transcription`)
        } else {
          // Step 3a: Transcribe video
          console.log(`[cron] Transcribing video ${video.id}...`)

          await upsertVideo({
            id: video.id,
            title: video.title,
            published_at: video.published_at,
            duration_sec: video.duration_sec,
            status: 'processing',
          })

          const videoUrl = `https://www.youtube.com/watch?v=${video.id}`

          const transcription = await transcribeVideo({
            videoUrl,
            langHint: 'en',
            mode: 'prerecorded',
          })

          await insertTranscript({
            video_id: video.id,
            text: transcription.text,
            language: transcription.language,
            source: 'deepgram',
          })

          console.log(`[cron] Transcription complete: ${transcription.text.length} characters`)
          summary.transcriptionsSucceeded++
        }

        // Step 3b: Mark video as succeeded (transcription done)
        await markVideoSucceeded(video.id)

        // Step 3c: Run Must-Roster AI agent
        console.log(`[cron] Running Must-Roster analysis for ${video.id}...`)

        const transcript = await fetchTranscriptByVideoId(video.id)

        if (!transcript || !transcript.text) {
          throw new Error('Transcript not found or empty after transcription')
        }

        const analysisStartTime = Date.now()

        const result = await mustRosterAgent.generate({
          prompt: `Analyze this fantasy basketball video transcript:\n\n${transcript.text}`,
        })

        const analysisTime = Date.now() - analysisStartTime

        console.log(
          `[cron] Must-Roster analysis complete in ${analysisTime}ms:`,
          `${result.experimental_output.players.length} players,`,
          `confidence: ${result.experimental_output.confidence}`
        )

        // Store the analysis result
        await upsertAnalysis({
          video_id: video.id,
          agent_type: 'must_roster',
          players: result.experimental_output.players,
          summary: result.experimental_output.summary,
          confidence: result.experimental_output.confidence,
          raw_response: result.text,
          notes: result.experimental_output.notes,
        })

        summary.analysesCompleted++

        // Step 3d: Check for HIGH urgency players and send Discord notification
        const highUrgencyPlayers = result.experimental_output.players.filter(
          (player: { urgency: string }) => player.urgency === 'HIGH'
        )

        if (highUrgencyPlayers.length > 0) {
          console.log(`[cron] Found ${highUrgencyPlayers.length} HIGH urgency players, sending Discord notification...`)

          await sendPlayerNotification({
            videoId: video.id,
            videoTitle: video.title,
            players: highUrgencyPlayers,
            summary: result.experimental_output.summary,
            confidence: result.experimental_output.confidence,
          })

          summary.highUrgencyPlayersFound += highUrgencyPlayers.length
          summary.notificationsSent++

          console.log(`[cron] Discord notification sent for ${highUrgencyPlayers.length} HIGH urgency players`)
        } else {
          console.log(`[cron] No HIGH urgency players found, skipping Discord notification`)
        }

        console.log(`[cron] ✅ Video ${video.id} processed successfully`)
      } catch (error) {
        const errorMsg = `Failed to process video ${video.id}: ${(error as Error).message}`
        console.error('[cron]', errorMsg)
        summary.errors.push(errorMsg)
        summary.transcriptionsFailed++

        // Mark video as failed
        await markVideoFailed(video.id, (error as Error).message)

        // Continue processing other videos (graceful degradation)
        console.log(`[cron] ❌ Video ${video.id} failed, continuing to next video...`)
      }
    }

    // ========================================================================
    // STEP 4: Log final summary
    // ========================================================================
    const totalTime = Date.now() - startTime

    console.log('[cron] ========================================')
    console.log('[cron] Automation Complete!')
    console.log('[cron] ========================================')
    console.log(`[cron] Total time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`[cron] Videos checked: ${summary.videosChecked}`)
    console.log(`[cron] New videos found: ${summary.newVideosFound}`)
    console.log(`[cron] Videos processed: ${summary.videosProcessed}`)
    console.log(`[cron] Transcriptions succeeded: ${summary.transcriptionsSucceeded}`)
    console.log(`[cron] Transcriptions failed: ${summary.transcriptionsFailed}`)
    console.log(`[cron] Analyses completed: ${summary.analysesCompleted}`)
    console.log(`[cron] HIGH urgency players found: ${summary.highUrgencyPlayersFound}`)
    console.log(`[cron] Discord notifications sent: ${summary.notificationsSent}`)
    console.log(`[cron] Errors: ${summary.errors.length}`)
    console.log('[cron] ========================================')

    return NextResponse.json({
      success: true,
      summary,
      totalTimeMs: totalTime,
    })
  } catch (error) {
    const errorMsg = `Automation failed: ${(error as Error).message}`
    console.error('[cron]', errorMsg)

    // Send error notification
    await sendErrorNotification(errorMsg, 'Critical automation failure')

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        summary,
      },
      { status: 500 }
    )
  }
}
