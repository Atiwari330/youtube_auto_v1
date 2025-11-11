import crypto from 'crypto'
import type { TranscribeRequest, TranscribeResponse, MediaWorkerError } from './types'

const MEDIA_WORKER_URL = process.env.MEDIA_WORKER_URL!
const MEDIA_WORKER_SECRET = process.env.MEDIA_WORKER_SECRET!

if (!MEDIA_WORKER_URL || !MEDIA_WORKER_SECRET) {
  throw new Error('Missing Media Worker environment variables. Check MEDIA_WORKER_URL and MEDIA_WORKER_SECRET in .env.local')
}

/**
 * Generate HMAC-SHA256 signature for request body
 * @param body - Request body object
 * @param secret - Shared secret key
 * @returns HMAC signature as hex string
 */
function generateSignature(body: any, secret: string): string {
  const payload = JSON.stringify(body)
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

/**
 * Transcribe a YouTube video by calling the Media Worker
 *
 * @param request - Transcription request parameters
 * @param retries - Number of retries on failure (default: 2)
 * @returns Transcription response with text and metadata
 * @throws Error if transcription fails after retries
 */
export async function transcribeVideo(
  request: TranscribeRequest,
  retries: number = 2
): Promise<TranscribeResponse> {
  const { videoUrl, langHint = 'en', mode = 'prerecorded' } = request

  const body: TranscribeRequest = {
    videoUrl,
    langHint,
    mode,
  }

  // Generate HMAC signature
  const signature = generateSignature(body, MEDIA_WORKER_SECRET)

  console.log(`[media-worker] Transcribing video: ${videoUrl}`)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 60000) // Exponential backoff: 1s, 2s, 4s, ...
      console.log(`[media-worker] Retry attempt ${attempt}/${retries} after ${delay}ms delay`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      console.log(`[media-worker] Attempt ${attempt + 1}: Calling ${MEDIA_WORKER_URL}/transcribe`)
      console.log(`[media-worker] Request body:`, { videoUrl, langHint, mode })
      console.log(`[media-worker] HMAC signature: ${signature.substring(0, 10)}...`)

      const response = await fetch(`${MEDIA_WORKER_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        body: JSON.stringify(body),
        // Increase timeout for long videos (up to 30 minutes)
        signal: AbortSignal.timeout(30 * 60 * 1000),
      })

      console.log(`[media-worker] Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorData: MediaWorkerError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }))

        console.error('[media-worker] Error response from media worker:', errorData)

        throw new Error(`Media Worker error: ${errorData.error}${errorData.details ? ` - ${errorData.details}` : ''}`)
      }

      const result: TranscribeResponse = await response.json()

      console.log(`[media-worker] Transcription successful: ${result.duration_sec}s, ${result.text.length} chars`)

      return result
    } catch (error) {
      lastError = error as Error
      console.error(`[media-worker] Attempt ${attempt + 1} failed:`, lastError.message)
      console.error(`[media-worker] Error name: ${lastError.name}`)
      console.error(`[media-worker] Error stack:`, lastError.stack)

      // Log fetch-specific errors with diagnostics
      if (error instanceof TypeError && lastError.message.includes('fetch')) {
        console.error('[media-worker] ========== FETCH ERROR DIAGNOSTICS ==========')
        console.error(`[media-worker] Target URL: ${MEDIA_WORKER_URL}/transcribe`)
        console.error(`[media-worker] Error type: Network connectivity or DNS resolution failure`)
        console.error(`[media-worker] Possible causes:`)
        console.error(`[media-worker]   1. Media worker container not running (check: docker ps)`)
        console.error(`[media-worker]   2. Wrong MEDIA_WORKER_URL in .env.local (current: ${MEDIA_WORKER_URL})`)
        console.error(`[media-worker]   3. Port 3001 not accessible or blocked by firewall`)
        console.error(`[media-worker]   4. Docker network issue`)
        console.error(`[media-worker] Diagnostic commands:`)
        console.error(`[media-worker]   - Test connectivity: curl ${MEDIA_WORKER_URL}/health`)
        console.error(`[media-worker]   - Check Docker: docker ps | grep media-worker`)
        console.error(`[media-worker]   - Check port: netstat -ano | findstr :3001`)
        console.error('[media-worker] ============================================')
      }

      // Don't retry on certain errors
      if (
        lastError.message.includes('Invalid signature') ||
        lastError.message.includes('400') ||
        lastError.message.includes('401')
      ) {
        console.error('[media-worker] Non-retryable error encountered, aborting')
        break
      }
    }
  }

  // All retries exhausted
  throw new Error(`Transcription failed after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Health check for Media Worker
 * @returns true if Media Worker is reachable, false otherwise
 */
export async function checkMediaWorkerHealth(): Promise<boolean> {
  try {
    console.log(`[media-worker] Running health check: ${MEDIA_WORKER_URL}/health`)
    const response = await fetch(`${MEDIA_WORKER_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (response.ok) {
      const data = await response.json()
      console.log('[media-worker] Health check passed:', data)
      return true
    } else {
      console.error(`[media-worker] Health check failed with status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error('[media-worker] Health check failed:', (error as Error).message)
    console.error('[media-worker] Error name:', (error as Error).name)
    if (error instanceof TypeError && (error as Error).message.includes('fetch')) {
      console.error('[media-worker] Cannot reach media worker - is Docker container running?')
    }
    return false
  }
}

/**
 * Verify HMAC signature on incoming request (for Media Worker to use)
 * @param body - Request body object
 * @param receivedSignature - Signature from X-Signature header
 * @param secret - Shared secret key
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(body: any, receivedSignature: string, secret: string): boolean {
  const expected = generateSignature(body, secret)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature))
}
