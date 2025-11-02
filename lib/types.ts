// Database types for Supabase tables

export type VideoStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

export interface Video {
  id: string // YouTube video_id
  title: string
  published_at: string // ISO 8601 timestamp
  duration_sec: number | null
  status: VideoStatus
  processed_at: string | null // ISO 8601 timestamp
  notes: string | null
  created_at: string // ISO 8601 timestamp
}

export interface Transcript {
  video_id: string
  source: string // e.g., 'deepgram'
  language: string | null
  text: string
  segments: TranscriptSegment[] | null
  created_at: string // ISO 8601 timestamp
}

export interface TranscriptSegment {
  start: number // seconds
  end: number // seconds
  text: string
  confidence?: number
}

// API Response types

export interface LatestTranscriptResponse {
  video_id: string
  title: string
  published_at: string
  transcript: string
  segments: TranscriptSegment[] | null
}

export interface CheckVideosResponse {
  processed: string[] // Array of video IDs that were processed
  latest: LatestTranscriptResponse | null
}

export interface VideosListResponse {
  videos: {
    id: string
    title: string
    published_at: string
    status: VideoStatus
    duration_sec: number | null
  }[]
}

// YouTube API types

export interface YouTubeVideo {
  id: string // video_id
  title: string
  publishedAt: string
  duration?: string // ISO 8601 duration format (e.g., PT15M33S)
}

// Media Worker types

export interface TranscribeRequest {
  videoUrl: string
  langHint?: string
  mode?: 'prerecorded' | 'streaming'
}

export interface TranscribeResponse {
  duration_sec: number
  text: string
  segments: TranscriptSegment[] | null
  language: string
}

export interface MediaWorkerError {
  error: string
  details?: string
}
