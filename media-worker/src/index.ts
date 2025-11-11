import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const MEDIA_WORKER_SECRET = process.env.MEDIA_WORKER_SECRET!
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!

if (!MEDIA_WORKER_SECRET || !DEEPGRAM_API_KEY) {
  console.error('[media-worker] Missing required environment variables!')
  console.error('[media-worker] Required: MEDIA_WORKER_SECRET, DEEPGRAM_API_KEY')
  process.exit(1)
}

// Log startup configuration
console.log('[media-worker] ===================================')
console.log('[media-worker] Configuration loaded:')
console.log(`[media-worker] - PORT: ${PORT}`)
console.log(`[media-worker] - MEDIA_WORKER_SECRET: ${MEDIA_WORKER_SECRET ? '✓ Set (length: ' + MEDIA_WORKER_SECRET.length + ')' : '✗ Missing'}`)
console.log(`[media-worker] - DEEPGRAM_API_KEY: ${DEEPGRAM_API_KEY ? '✓ Set (length: ' + DEEPGRAM_API_KEY.length + ')' : '✗ Missing'}`)
console.log('[media-worker] ===================================')

app.use(express.json())

// ============================================================================
// HMAC Signature Verification Middleware
// ============================================================================

function verifySignature(body: any, receivedSignature: string, secret: string): boolean {
  const payload = JSON.stringify(body)
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  )
}

// ============================================================================
// Health Check Endpoint
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  console.log('[media-worker] Health check requested')
  res.json({ status: 'healthy', service: 'media-worker', timestamp: new Date().toISOString() })
})

// ============================================================================
// Transcribe Endpoint
// ============================================================================

interface TranscribeRequest {
  videoUrl: string
  langHint?: string
  mode?: 'prerecorded' | 'streaming'
}

interface TranscribeResponse {
  duration_sec: number
  text: string
  segments: any | null
  language: string
}

app.post('/transcribe', async (req: Request, res: Response) => {
  const startTime = Date.now()
  const requestId = `req-${Date.now()}`

  console.log(`[media-worker] ${requestId} - Received transcription request`)
  console.log(`[media-worker] ${requestId} - Request headers:`, {
    'content-type': req.headers['content-type'],
    'x-signature': req.headers['x-signature'] ? `${(req.headers['x-signature'] as string).substring(0, 10)}...` : 'MISSING'
  })

  // Temp file paths
  let tempAudioFile: string | null = null
  let tempWavFile: string | null = null

  try {
    // Step 1: Verify HMAC signature
    const receivedSignature = req.headers['x-signature'] as string

    if (!receivedSignature) {
      console.error(`[media-worker] ${requestId} - Missing X-Signature header`)
      return res.status(401).json({ error: 'Missing signature' })
    }

    console.log(`[media-worker] ${requestId} - Verifying HMAC signature...`)
    const isValidSignature = verifySignature(req.body, receivedSignature, MEDIA_WORKER_SECRET)

    if (!isValidSignature) {
      console.error(`[media-worker] ${requestId} - Invalid signature`)
      console.error(`[media-worker] ${requestId} - Received signature: ${receivedSignature.substring(0, 10)}...`)
      console.error(`[media-worker] ${requestId} - Request body:`, JSON.stringify(req.body))
      console.error(`[media-worker] ${requestId} - This usually means MEDIA_WORKER_SECRET mismatch between Next.js and media worker`)
      return res.status(401).json({ error: 'Invalid signature' })
    }

    console.log(`[media-worker] ${requestId} - HMAC signature verified successfully`)

    // Step 2: Parse request
    const { videoUrl, langHint = 'en', mode = 'prerecorded' }: TranscribeRequest = req.body

    if (!videoUrl) {
      console.error(`[media-worker] ${requestId} - Missing videoUrl parameter`)
      return res.status(400).json({ error: 'Missing videoUrl parameter' })
    }

    console.log(`[media-worker] ${requestId} - Transcribing: ${videoUrl}`)
    console.log(`[media-worker] ${requestId} - Language hint: ${langHint}, Mode: ${mode}`)

    // Step 3: Create temp file paths
    const timestamp = Date.now()
    const tempDir = os.tmpdir()
    tempAudioFile = path.join(tempDir, `audio-${timestamp}.webm`)
    tempWavFile = path.join(tempDir, `audio-${timestamp}.wav`)

    console.log(`[media-worker] ${requestId} - Downloading audio to ${tempAudioFile}`)

    // Step 4: Download audio using yt-dlp
    await new Promise<void>((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', [
        '-f', 'bestaudio/best',
        '-o', tempAudioFile!,
        videoUrl
      ])

      let ytdlpErrors = ''

      ytdlp.stderr.on('data', (data) => {
        ytdlpErrors += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code === 0) {
          console.log(`[media-worker] ${requestId} - Audio download complete`)
          resolve()
        } else {
          console.error(`[media-worker] ${requestId} - yt-dlp failed with code ${code}`)
          console.error(`[media-worker] ${requestId} - yt-dlp errors:`, ytdlpErrors)
          reject(new Error(`yt-dlp failed with code ${code}`))
        }
      })

      ytdlp.on('error', (err) => {
        console.error(`[media-worker] ${requestId} - yt-dlp spawn error:`, err)
        reject(err)
      })
    })

    console.log(`[media-worker] ${requestId} - Converting to WAV: ${tempWavFile}`)

    // Step 5: Convert to WAV using ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempAudioFile!,
        '-ac', '1',              // Mono audio
        '-ar', '16000',          // 16kHz sample rate
        '-f', 'wav',             // WAV format
        tempWavFile!
      ])

      let ffmpegErrors = ''

      ffmpeg.stderr.on('data', (data) => {
        ffmpegErrors += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`[media-worker] ${requestId} - Audio conversion complete`)
          resolve()
        } else {
          console.error(`[media-worker] ${requestId} - ffmpeg failed with code ${code}`)
          console.error(`[media-worker] ${requestId} - ffmpeg errors:`, ffmpegErrors)
          reject(new Error(`ffmpeg failed with code ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error(`[media-worker] ${requestId} - ffmpeg spawn error:`, err)
        reject(err)
      })
    })

    console.log(`[media-worker] ${requestId} - Reading WAV file for Deepgram`)

    // Step 6: Read the WAV file
    const audioBuffer = await fs.readFile(tempWavFile)
    console.log(`[media-worker] ${requestId} - Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Step 7: Send to Deepgram
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=general&language=${langHint}`

    console.log(`[media-worker] ${requestId} - Sending ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB to Deepgram API`)
    console.log(`[media-worker] ${requestId} - Deepgram URL: ${deepgramUrl}`)
    console.log(`[media-worker] ${requestId} - Deepgram API key length: ${DEEPGRAM_API_KEY.length}`)

    let deepgramResponse
    try {
      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBuffer,
      })

      console.log(`[media-worker] ${requestId} - Deepgram response status: ${deepgramResponse.status} ${deepgramResponse.statusText}`)
    } catch (fetchError) {
      console.error(`[media-worker] ${requestId} - Failed to reach Deepgram API:`, fetchError)
      console.error(`[media-worker] ${requestId} - Error name:`, (fetchError as Error).name)
      console.error(`[media-worker] ${requestId} - Error message:`, (fetchError as Error).message)
      console.error(`[media-worker] ${requestId} - Possible causes:`)
      console.error(`[media-worker] ${requestId}   - Network connectivity issue`)
      console.error(`[media-worker] ${requestId}   - Invalid DEEPGRAM_API_KEY`)
      console.error(`[media-worker] ${requestId}   - Deepgram service outage`)

      return res.status(500).json({
        error: 'Failed to connect to Deepgram API',
        details: (fetchError as Error).message,
      })
    }

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text()
      console.error(`[media-worker] ${requestId} - Deepgram API error (${deepgramResponse.status}):`, errorText)
      console.error(`[media-worker] ${requestId} - Response headers:`, Object.fromEntries(deepgramResponse.headers.entries()))

      return res.status(500).json({
        error: 'Deepgram transcription failed',
        details: errorText,
      })
    }

    const deepgramData = await deepgramResponse.json() as any
    console.log(`[media-worker] ${requestId} - Deepgram transcription received`)

    // Step 8: Extract transcript from Deepgram response
    const transcript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const words = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.words || []
    const duration = deepgramData.metadata?.duration || 0
    const language = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0] || langHint

    const wallClockMs = Date.now() - startTime

    console.log(`[media-worker] ${requestId} - ✓ Transcription complete: ${duration.toFixed(1)}s video, ${transcript.length} chars, ${wallClockMs}ms wall clock`)

    const response: TranscribeResponse = {
      duration_sec: Math.round(duration),
      text: transcript,
      segments: null, // Phase 1: full text only
      language,
    }

    res.json(response)
  } catch (error) {
    console.error(`[media-worker] ${requestId} - ✗ Error during transcription:`, error)
    console.error(`[media-worker] ${requestId} - Error name:`, (error as Error).name)
    console.error(`[media-worker] ${requestId} - Error message:`, (error as Error).message)
    console.error(`[media-worker] ${requestId} - Error stack:`, (error as Error).stack)

    res.status(500).json({
      error: 'Transcription failed',
      details: (error as Error).message,
    })
  } finally {
    // Step 9: Clean up temp files
    try {
      if (tempAudioFile) {
        await fs.unlink(tempAudioFile)
        console.log(`[media-worker] ${requestId} - Cleaned up ${tempAudioFile}`)
      }
    } catch (err) {
      console.error(`[media-worker] ${requestId} - Failed to delete temp audio file:`, err)
    }

    try {
      if (tempWavFile) {
        await fs.unlink(tempWavFile)
        console.log(`[media-worker] ${requestId} - Cleaned up ${tempWavFile}`)
      }
    } catch (err) {
      console.error(`[media-worker] ${requestId} - Failed to delete temp WAV file:`, err)
    }
  }
})

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`[media-worker] Server running on port ${PORT}`)
  console.log(`[media-worker] Health check: http://localhost:${PORT}/health`)
  console.log(`[media-worker] Transcribe endpoint: POST http://localhost:${PORT}/transcribe`)
})
