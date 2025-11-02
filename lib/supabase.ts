import { createClient } from '@supabase/supabase-js'
import type { Video, Transcript, VideoStatus } from './types'

// Singleton Supabase client for server-side operations
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ============================================================================
// Video Operations
// ============================================================================

/**
 * Check if videos exist in the database
 * @param videoIds - Array of YouTube video IDs to check
 * @returns Array of video IDs that exist in the database
 */
export async function selectVideoIds(videoIds: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id')
    .in('id', videoIds)

  if (error) {
    console.error('[supabase] Error selecting video IDs:', error)
    throw new Error(`Failed to check existing videos: ${error.message}`)
  }

  return data.map(v => v.id)
}

/**
 * Insert or update a video record
 * @param video - Partial video object with at least id, title, published_at
 */
export async function upsertVideo(video: {
  id: string
  title: string
  published_at: string
  duration_sec?: number
  status?: VideoStatus
  processed_at?: string | null
  notes?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .upsert({
      id: video.id,
      title: video.title,
      published_at: video.published_at,
      duration_sec: video.duration_sec || null,
      status: video.status || 'queued',
      processed_at: video.processed_at || null,
      notes: video.notes || null,
    }, {
      onConflict: 'id'
    })

  if (error) {
    console.error('[supabase] Error upserting video:', error)
    throw new Error(`Failed to upsert video ${video.id}: ${error.message}`)
  }

  console.log(`[supabase] Video ${video.id} upserted with status: ${video.status || 'queued'}`)
}

/**
 * Mark a video as succeeded and record the processed time
 * @param videoId - YouTube video ID
 */
export async function markVideoSucceeded(videoId: string): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({
      status: 'succeeded',
      processed_at: new Date().toISOString(),
    })
    .eq('id', videoId)

  if (error) {
    console.error('[supabase] Error marking video as succeeded:', error)
    throw new Error(`Failed to mark video ${videoId} as succeeded: ${error.message}`)
  }

  console.log(`[supabase] Video ${videoId} marked as succeeded`)
}

/**
 * Mark a video as failed with error notes
 * @param videoId - YouTube video ID
 * @param errorMessage - Error message to store
 */
export async function markVideoFailed(videoId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      notes: errorMessage,
    })
    .eq('id', videoId)

  if (error) {
    console.error('[supabase] Error marking video as failed:', error)
    throw new Error(`Failed to mark video ${videoId} as failed: ${error.message}`)
  }

  console.log(`[supabase] Video ${videoId} marked as failed: ${errorMessage}`)
}

/**
 * Get all videos with a specific status
 * @param status - Video status to filter by
 * @returns Array of matching videos
 */
export async function getVideosByStatus(status: VideoStatus): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', status)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[supabase] Error fetching videos by status:', error)
    throw new Error(`Failed to fetch videos with status ${status}: ${error.message}`)
  }

  return data as Video[]
}

/**
 * Get recently processed videos
 * @param limit - Maximum number of videos to return (default: 10)
 * @returns Array of recent videos
 */
export async function getRecentVideos(limit: number = 10): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('processed_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('[supabase] Error fetching recent videos:', error)
    throw new Error(`Failed to fetch recent videos: ${error.message}`)
  }

  return data as Video[]
}

// ============================================================================
// Transcript Operations
// ============================================================================

/**
 * Insert a transcript for a video
 * @param transcript - Transcript data
 */
export async function insertTranscript(transcript: {
  video_id: string
  text: string
  language?: string
  segments?: any
  source?: string
}): Promise<void> {
  const { error } = await supabase
    .from('transcripts')
    .upsert({
      video_id: transcript.video_id,
      source: transcript.source || 'deepgram',
      language: transcript.language || null,
      text: transcript.text,
      segments: transcript.segments || null,
    }, {
      onConflict: 'video_id'
    })

  if (error) {
    console.error('[supabase] Error inserting transcript:', error)
    throw new Error(`Failed to insert transcript for video ${transcript.video_id}: ${error.message}`)
  }

  console.log(`[supabase] Transcript for video ${transcript.video_id} inserted (${transcript.text.length} characters)`)
}

/**
 * Fetch the latest successful transcript
 * @returns Latest transcript with video details, or null if none found
 */
export async function fetchLatestTranscript(): Promise<{
  video_id: string
  title: string
  published_at: string
  transcript: string
  segments: any
} | null> {
  // Query videos with status='succeeded', join with transcripts, order by processed_at desc
  const { data, error } = await supabase
    .from('videos')
    .select(`
      id,
      title,
      published_at,
      transcripts (
        text,
        segments
      )
    `)
    .eq('status', 'succeeded')
    .not('transcripts', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('[supabase] Error fetching latest transcript:', error)
    throw new Error(`Failed to fetch latest transcript: ${error.message}`)
  }

  if (!data || !data.transcripts) {
    return null
  }

  // Type assertion because Supabase returns nested objects
  const transcriptData = Array.isArray(data.transcripts) ? data.transcripts[0] : data.transcripts

  return {
    video_id: data.id,
    title: data.title,
    published_at: data.published_at,
    transcript: transcriptData.text,
    segments: transcriptData.segments,
  }
}

/**
 * Fetch transcript for a specific video
 * @param videoId - YouTube video ID
 * @returns Transcript or null if not found
 */
export async function fetchTranscriptByVideoId(videoId: string): Promise<Transcript | null> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('video_id', videoId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[supabase] Error fetching transcript:', error)
    throw new Error(`Failed to fetch transcript for video ${videoId}: ${error.message}`)
  }

  return data as Transcript
}
