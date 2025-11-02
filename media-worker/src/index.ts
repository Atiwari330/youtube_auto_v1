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
  res.json({ status: 'ok', service: 'media-worker', timestamp: new Date().toISOString() })
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

  // Temp file paths
  let tempAudioFile: string | null = null
  let tempWavFile: string | null = null

  try {
    // Step 1: Verify HMAC signature
    const receivedSignature = req.headers['x-signature'] as string

    if (!receivedSignature) {
      console.error('[media-worker] Missing X-Signature header')
      return res.status(401).json({ error: 'Missing signature' })
    }

    if (!verifySignature(req.body, receivedSignature, MEDIA_WORKER_SECRET)) {
      console.error('[media-worker] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Step 2: Parse request
    const { videoUrl, langHint = 'en', mode = 'prerecorded' }: TranscribeRequest = req.body

    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing videoUrl parameter' })
    }

    console.log(`[media-worker] Transcribing: ${videoUrl}`)

    // Step 3: Create temp file paths
    const timestamp = Date.now()
    const tempDir = os.tmpdir()
    tempAudioFile = path.join(tempDir, `audio-${timestamp}.webm`)
    tempWavFile = path.join(tempDir, `audio-${timestamp}.wav`)

    console.log(`[media-worker] Downloading audio to ${tempAudioFile}`)

    // Step 4: Download audio using yt-dlp
    await new Promise<void>((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', [
        '-f', 'bestaudio',
        '-o', tempAudioFile!,
        videoUrl
      ])

      let ytdlpErrors = ''

      ytdlp.stderr.on('data', (data) => {
        ytdlpErrors += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code === 0) {
          console.log('[media-worker] Audio download complete')
          resolve()
        } else {
          console.error('[media-worker] yt-dlp failed:', ytdlpErrors)
          reject(new Error(`yt-dlp failed with code ${code}`))
        }
      })

      ytdlp.on('error', (err) => {
        console.error('[media-worker] yt-dlp spawn error:', err)
        reject(err)
      })
    })

    console.log(`[media-worker] Converting to WAV: ${tempWavFile}`)

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
          console.log('[media-worker] Audio conversion complete')
          resolve()
        } else {
          console.error('[media-worker] ffmpeg failed:', ffmpegErrors)
          reject(new Error(`ffmpeg failed with code ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('[media-worker] ffmpeg spawn error:', err)
        reject(err)
      })
    })

    console.log(`[media-worker] Reading WAV file for Deepgram`)

    // Step 6: Read the WAV file
    const audioBuffer = await fs.readFile(tempWavFile)
    console.log(`[media-worker] Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Step 7: Send to Deepgram
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=general&language=${langHint}`

    const deepgramResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    })

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text()
      console.error('[media-worker] Deepgram API error:', errorText)

      return res.status(500).json({
        error: 'Deepgram transcription failed',
        details: errorText,
      })
    }

    const deepgramData = await deepgramResponse.json() as any

    // Step 8: Extract transcript from Deepgram response
    const transcript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const words = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.words || []
    const duration = deepgramData.metadata?.duration || 0
    const language = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0] || langHint

    const wallClockMs = Date.now() - startTime

    console.log(`[media-worker] Transcription complete: ${duration.toFixed(1)}s video, ${transcript.length} chars, ${wallClockMs}ms wall clock`)

    const response: TranscribeResponse = {
      duration_sec: Math.round(duration),
      text: transcript,
      segments: null, // Phase 1: full text only
      language,
    }

    res.json(response)
  } catch (error) {
    console.error('[media-worker] Error:', error)

    res.status(500).json({
      error: 'Transcription failed',
      details: (error as Error).message,
    })
  } finally {
    // Step 9: Clean up temp files
    try {
      if (tempAudioFile) {
        await fs.unlink(tempAudioFile)
        console.log(`[media-worker] Cleaned up ${tempAudioFile}`)
      }
    } catch (err) {
      console.error('[media-worker] Failed to delete temp audio file:', err)
    }

    try {
      if (tempWavFile) {
        await fs.unlink(tempWavFile)
        console.log(`[media-worker] Cleaned up ${tempWavFile}`)
      }
    } catch (err) {
      console.error('[media-worker] Failed to delete temp WAV file:', err)
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
