import type { YouTubeVideo } from './types'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID!

if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) {
  throw new Error('Missing YouTube environment variables. Check YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in .env.local')
}

/**
 * Parse ISO 8601 duration format (e.g., PT15M33S) to seconds
 * @param duration - ISO 8601 duration string
 * @returns Duration in seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Get the uploads playlist ID for a channel
 *
 * YouTube channel IDs start with "UC". The uploads playlist ID is the same
 * as the channel ID but with "UC" replaced by "UU".
 *
 * @param channelId - YouTube channel ID
 * @returns Uploads playlist ID
 */
function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.slice(2)
  }

  // If it doesn't start with UC, we need to fetch the channel details
  // For now, throw an error - this is a rare edge case
  throw new Error(`Invalid channel ID format: ${channelId}. Expected format: UCxxxxxxxxxx`)
}

/**
 * List the latest videos from a channel's uploads playlist
 *
 * @param options - Configuration options
 * @param options.channelId - YouTube channel ID (optional, uses env var if not provided)
 * @param options.apiKey - YouTube API key (optional, uses env var if not provided)
 * @param options.maxResults - Maximum number of videos to fetch (default: 10, max: 50)
 * @returns Array of video objects with id, title, publishedAt, duration
 */
export async function listChannelUploads(options: {
  channelId?: string
  apiKey?: string
  maxResults?: number
} = {}): Promise<YouTubeVideo[]> {
  const channelId = options.channelId || YOUTUBE_CHANNEL_ID
  const apiKey = options.apiKey || YOUTUBE_API_KEY
  const maxResults = Math.min(options.maxResults || 10, 50)

  // Get uploads playlist ID
  const uploadsPlaylistId = getUploadsPlaylistId(channelId)

  console.log(`[youtube] Fetching latest ${maxResults} videos from channel ${channelId}`)

  // Step 1: Get playlist items (video IDs and basic info)
  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  playlistUrl.searchParams.set('part', 'snippet')
  playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
  playlistUrl.searchParams.set('maxResults', maxResults.toString())
  playlistUrl.searchParams.set('key', apiKey)

  const playlistResponse = await fetch(playlistUrl.toString())

  if (!playlistResponse.ok) {
    const errorText = await playlistResponse.text()
    console.error('[youtube] Playlist API error:', errorText)
    throw new Error(`YouTube API error (${playlistResponse.status}): ${errorText}`)
  }

  const playlistData = await playlistResponse.json()

  if (!playlistData.items || playlistData.items.length === 0) {
    console.log('[youtube] No videos found in uploads playlist')
    return []
  }

  // Extract video IDs
  const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId)

  console.log(`[youtube] Found ${videoIds.length} videos, fetching details...`)

  // Step 2: Get video details (including duration)
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('part', 'contentDetails,snippet')
  videosUrl.searchParams.set('id', videoIds.join(','))
  videosUrl.searchParams.set('key', apiKey)

  const videosResponse = await fetch(videosUrl.toString())

  if (!videosResponse.ok) {
    const errorText = await videosResponse.text()
    console.error('[youtube] Videos API error:', errorText)
    throw new Error(`YouTube API error (${videosResponse.status}): ${errorText}`)
  }

  const videosData = await videosResponse.json()

  // Map to our YouTubeVideo type
  const videos: YouTubeVideo[] = videosData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    duration: item.contentDetails.duration, // ISO 8601 format (e.g., PT15M33S)
  }))

  console.log(`[youtube] Fetched ${videos.length} videos with details`)

  return videos
}

/**
 * Get a single video's details by ID
 * @param videoId - YouTube video ID
 * @returns Video details or null if not found
 */
export async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  const apiKey = YOUTUBE_API_KEY

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'contentDetails,snippet')
  url.searchParams.set('id', videoId)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[youtube] Video details API error:', errorText)
    throw new Error(`YouTube API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (!data.items || data.items.length === 0) {
    return null
  }

  const item = data.items[0]

  return {
    id: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    duration: item.contentDetails.duration,
  }
}

/**
 * Convert YouTube ISO 8601 duration to seconds
 * @param duration - ISO 8601 duration string (e.g., PT15M33S)
 * @returns Duration in seconds
 */
export function durationToSeconds(duration: string): number {
  return parseDuration(duration)
}

/**
 * Format seconds to human-readable duration
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g., "15:33" or "1:23:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
