# Architecture Log - YouTube Transcript Automation Tool

**Project**: One-Button YouTube → Transcript
**Started**: 2025-11-02
**Status**: In Development

---

## Project Overview

This is a minimal Next.js web application that automates the process of:
1. Checking a preconfigured YouTube channel for new videos
2. Extracting audio and transcribing via Deepgram STT
3. Storing transcripts in Supabase
4. Displaying the latest transcript in a simple UI

**Key Principle**: One-button operation with deterministic, idempotent processing.

---

## Technology Stack

### Frontend & Backend
- **Next.js 15** (App Router) - Server-side rendering and API routes
- **TypeScript** - Type safety across the stack
- **Tailwind CSS** - Utility-first styling
- **React 19** - UI components

### Database & APIs
- **Supabase** (PostgreSQL) - Video and transcript storage
- **YouTube Data API v3** - Channel uploads polling
- **Deepgram API** - Speech-to-text transcription

### Media Processing
- **Media Worker** (Node.js/TypeScript) - Separate service for audio extraction
- **yt-dlp** - YouTube video/audio downloading
- **ffmpeg** - Audio format conversion
- **Docker** - Containerization for deployment

### Deployment Targets
- **Next.js App**: Vercel (or similar)
- **Media Worker**: Cloud Run / Fly.io

---

## System Architecture

```
┌─────────────┐
│   Browser   │
│             │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────────────────────────┐
│   Next.js 15 Application        │
│   ┌─────────────────────────┐   │
│   │  /app/page.tsx (UI)     │   │
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  /app/api/check         │   │
│   │  /app/api/transcripts   │   │
│   │  /app/api/videos        │   │
│   └─────────────────────────┘   │
└───┬─────────────┬───────────┬───┘
    │             │           │
    │ REST        │ SQL       │ HMAC-signed HTTP
    ▼             ▼           ▼
┌────────┐   ┌──────────┐   ┌─────────────────┐
│YouTube │   │ Supabase │   │  Media Worker   │
│Data API│   │Postgres  │   │  (Docker)       │
└────────┘   └──────────┘   │  ┌───────────┐  │
                             │  │ yt-dlp    │  │
                             │  │ ffmpeg    │  │
                             │  │ Deepgram │  │
                             │  └───────────┘  │
                             └─────────────────┘
```

---

## Core Data Flow

### 1. User Clicks "Check for new videos"

**Request Flow**:
```
UI → POST /api/check → YouTube API (list uploads)
                    → Supabase (fetch processed IDs)
                    → Compute diff (new videos)
                    → For each new video:
                      → Media Worker (extract + transcribe)
                      → Supabase (store transcript)
                    → Return latest transcript
                    ← UI (display)
```

### 2. Media Worker Processing

**Audio Extraction Flow**:
```
Media Worker receives videoUrl
  ↓ yt-dlp extracts best audio stream
  ↓ ffmpeg converts to mono 16kHz WAV
  ↓ Stream to Deepgram pre-recorded API
  ↓ Receive transcript text
  ↓ Return to Next.js API
```

---

## Security Model

### Authentication & Authorization
- **No user auth** (single admin view)
- **Media Worker** protected by HMAC signature verification
- All API keys stored in environment variables (never in client)

### HMAC Signature Flow
```typescript
// Next.js signs request
const signature = HMAC-SHA256(requestBody, MEDIA_WORKER_SECRET)
headers['X-Signature'] = signature

// Media Worker verifies
const expected = HMAC-SHA256(requestBody, MEDIA_WORKER_SECRET)
if (received !== expected) return 401
```

---

## Database Schema

### `videos` Table
| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | YouTube video_id |
| title | text | Video title |
| published_at | timestamptz | YouTube publish date |
| duration_sec | int | Video length in seconds |
| status | text | queued \| processing \| succeeded \| failed |
| processed_at | timestamptz | When we finished processing |
| notes | text | Error messages if failed |

### `transcripts` Table
| Column | Type | Description |
|--------|------|-------------|
| video_id | text (PK, FK) | References videos.id |
| source | text | Always 'deepgram' |
| language | text | Detected/specified language |
| text | text | Full transcript text |
| segments | jsonb | NULL (full text only, no timings) |
| created_at | timestamptz | Timestamp |

**Indexes**:
- `idx_videos_published_at` on `videos(published_at DESC)`
- `idx_videos_status` on `videos(status)`

---

## API Endpoints

### Next.js Routes

#### `POST /api/check`
**Purpose**: Check for new videos and process them
**Request**: `{ limit?: number }` (optional, default 5)
**Response**:
```json
{
  "processed": ["VIDEO_ID_1", "VIDEO_ID_2"],
  "latest": {
    "video_id": "VIDEO_ID_2",
    "title": "Video Title",
    "published_at": "2025-11-02T15:00:00Z",
    "transcript": "Full transcript text...",
    "segments": null
  }
}
```

#### `GET /api/transcripts/latest`
**Purpose**: Fetch the most recent successful transcript
**Response**: Same as `latest` object above

#### `GET /api/videos`
**Purpose**: List recently processed videos
**Response**:
```json
{
  "videos": [
    {
      "id": "VIDEO_ID",
      "title": "...",
      "published_at": "...",
      "status": "succeeded"
    }
  ]
}
```

### Media Worker Routes

#### `POST /transcribe`
**Purpose**: Extract audio and transcribe a YouTube video
**Headers**: `X-Signature: HMAC256(body, secret)`
**Request**:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "langHint": "en",
  "mode": "prerecorded"
}
```
**Response**:
```json
{
  "duration_sec": 1834,
  "text": "Full transcript...",
  "segments": null,
  "language": "en"
}
```

---

## Error Handling Strategy

### Retry Logic
- **YouTube API failures**: No retry (user can click again)
- **Media Worker failures**: 2 retries with exponential backoff (30s, 2m)
- **Deepgram failures**: 1 retry, then mark as failed

### Status Tracking
```
Video Status Flow:
  queued → processing → succeeded
                    ↓
                  failed (with notes)
```

### User-Facing Errors
- **API failures**: Log server-side, show "No new uploads" to user
- **Partial failures**: Process successful videos, ignore failures
- **Complete failure**: Show friendly error message

---

## Configuration & Environment Variables

### Next.js App (.env.local)
```bash
YOUTUBE_API_KEY=          # YouTube Data API v3 key
YOUTUBE_CHANNEL_ID=       # Target channel ID
SUPABASE_URL=             # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key
DEEPGRAM_API_KEY=         # Deepgram API key (passed to worker)
MEDIA_WORKER_URL=         # http://localhost:3001 or production URL
MEDIA_WORKER_SECRET=      # Shared secret for HMAC
LANG_HINT=en              # Default language hint
```

### Media Worker (.env)
```bash
MEDIA_WORKER_SECRET=      # Same secret as Next.js
DEEPGRAM_API_KEY=         # Deepgram API key
PORT=3001                 # Worker port
```

---

## Development Log

### Phase 0: Documentation Setup
**Date**: 2025-11-02
**Status**: ✅ Completed

- [DONE] Created ARCHITECTURE.md as living document
- Will be updated at each phase with decisions and implementation details

### Phase 1: Project Setup & Configuration
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration with strict mode
- `next.config.ts` - Next.js 15 configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS with Tailwind and Autoprefixer
- `.gitignore` - Ignore node_modules, .env files, and build outputs
- `.env.local.example` - Environment variable template
- `SETUP.md` - Comprehensive setup guide with API key instructions

**Directory Structure**:
```
youtube_auto_v1/
├── app/
│   ├── api/
│   │   ├── check/
│   │   ├── transcripts/
│   │   └── videos/
│   ├── globals.css
│   └── layout.tsx
├── lib/
├── components/
├── public/
└── supabase/
    └── migrations/
```

**Dependencies Installed**:
- Next.js 15.0.2 (App Router)
- React 19
- Supabase JavaScript Client 2.39.0
- TypeScript 5
- Tailwind CSS 3.4.0

**Key Decisions Made**:
1. Using Next.js 15 App Router (not Pages Router)
2. TypeScript in strict mode for type safety
3. Tailwind CSS for styling (utility-first approach)
4. Supabase JS client for database operations
5. Environment variables managed via `.env.local` (excluded from git)

**Next Steps**: Phase 2 - Database Setup

### Phase 2: Database Setup
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `supabase/migrations/001_initial_schema.sql` - Database schema with videos and transcripts tables
- `lib/types.ts` - TypeScript interfaces for all database entities and API responses
- `lib/supabase.ts` - Supabase client and database utility functions

**Database Schema**:
1. **videos table**: Tracks YouTube videos and their processing status
   - Primary key: `id` (YouTube video_id)
   - Tracks: title, published_at, duration, status, processing timestamps
   - Status flow: `queued` → `processing` → `succeeded` | `failed`

2. **transcripts table**: Stores STT-generated transcripts
   - Primary key: `video_id` (references videos.id)
   - Stores: full text, language, source (deepgram), segments (null in Phase 1)
   - Cascade delete when video is deleted

3. **settings table** (optional): For storing channel configuration

**Indexes Created**:
- `idx_videos_published_at` - For chronological queries
- `idx_videos_status` - For filtering by processing state
- `idx_videos_created_at` - For recent video queries

**Utility Functions Created**:
- `selectVideoIds()` - Check if videos exist in DB
- `upsertVideo()` - Insert or update video record
- `markVideoSucceeded()` - Mark video as successfully processed
- `markVideoFailed()` - Mark video as failed with error notes
- `getVideosByStatus()` - Fetch videos by status
- `getRecentVideos()` - Get recently processed videos
- `insertTranscript()` - Store transcript for a video
- `fetchLatestTranscript()` - Get the most recent successful transcript
- `fetchTranscriptByVideoId()` - Get transcript for specific video

**Key Design Decisions**:
1. **Idempotency**: Using `upsert` operations with `video.id` as unique constraint
2. **Cascade Delete**: Transcripts are deleted when parent video is deleted
3. **Structured Logging**: Console logs for all database operations
4. **Error Handling**: Try-catch with descriptive error messages
5. **Nullable Fields**: `duration_sec`, `processed_at`, `notes`, `segments` can be null

**Next Steps**: Phase 3 - Next.js Backend API Routes

### Phase 3: Next.js Backend
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `lib/youtube.ts` - YouTube Data API integration
- `lib/media-worker-client.ts` - Media Worker HTTP client with HMAC signing
- `app/api/check/route.ts` - Main endpoint for checking and processing new videos
- `app/api/transcripts/latest/route.ts` - Endpoint to fetch latest transcript
- `app/api/videos/route.ts` - Endpoint to list recently processed videos

**YouTube API Integration (`lib/youtube.ts`)**:
- `listChannelUploads()` - Fetch latest videos from channel uploads playlist
- `getVideoDetails()` - Get single video details by ID
- `durationToSeconds()` - Convert ISO 8601 duration to seconds
- `formatDuration()` - Format seconds to human-readable duration
- Automatically converts channel ID to uploads playlist ID (UC → UU)
- Fetches both playlist items and video details for complete metadata

**Media Worker Client (`lib/media-worker-client.ts`)**:
- `transcribeVideo()` - Call Media Worker with HMAC-signed request
- `generateSignature()` - Create HMAC-SHA256 signature for request body
- `verifySignature()` - Verify incoming signatures (for Media Worker use)
- `checkMediaWorkerHealth()` - Health check endpoint
- Implements exponential backoff retry logic (2 retries by default)
- 30-minute timeout for long video transcriptions

**API Route: POST /api/check**:
Workflow:
1. Fetch latest uploads from YouTube (configurable limit, default 5)
2. Query Supabase for already-processed video IDs
3. Compute diff to find new videos
4. For each new video:
   - Insert with status='processing'
   - Call Media Worker to transcribe
   - Store transcript in database
   - Mark as 'succeeded' or 'failed'
5. Return list of processed IDs + latest transcript

Features:
- Idempotent (won't duplicate processing)
- Sequential processing (one video at a time)
- Graceful error handling (failed videos don't block others)
- 5-minute max duration (configurable)

**API Route: GET /api/transcripts/latest**:
- Returns most recent successful transcript
- Includes video metadata (title, published_at)
- Returns 404 if no transcripts exist

**API Route: GET /api/videos**:
- Lists recently processed videos
- Supports `?limit=N` query parameter (default 10, max 50)
- Returns id, title, status, published_at, duration_sec

**Key Design Decisions**:
1. **Sequential Processing**: Process videos one at a time to avoid overwhelming Media Worker and Deepgram API
2. **Error Isolation**: Failed videos marked as 'failed' but don't prevent other videos from processing
3. **HMAC Security**: All Media Worker requests signed with HMAC-SHA256
4. **Retry Logic**: Exponential backoff with 2 retries for transient failures
5. **No Retry on Auth Errors**: 400/401 errors immediately fail (non-retryable)

**Next Steps**: Phase 4 - Media Worker Service

### Phase 4: Media Worker
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `media-worker/package.json` - Node.js dependencies (Express, dotenv, form-data)
- `media-worker/tsconfig.json` - TypeScript configuration
- `media-worker/src/index.ts` - Main Express server with transcription endpoint
- `media-worker/Dockerfile` - Multi-stage Docker build with yt-dlp + ffmpeg + Node.js
- `media-worker/.dockerignore` - Exclude unnecessary files from Docker build
- `media-worker/.env.example` - Environment variable template
- `docker-compose.yml` - Docker Compose for local development

**Media Worker Service Architecture**:
The Media Worker is a standalone Express.js service that:
1. **Receives transcription requests** from the Next.js app (via POST /transcribe)
2. **Verifies HMAC signature** to ensure request authenticity
3. **Extracts audio** from YouTube using yt-dlp → ffmpeg pipeline
4. **Streams audio to Deepgram** for speech-to-text transcription
5. **Returns transcript** with metadata (text, duration, language)

**Audio Extraction Pipeline**:
```
YouTube URL
  ↓ yt-dlp (extract best audio stream)
  ↓ ffmpeg (convert to mono 16kHz WAV)
  ↓ Stream to Deepgram API
  ↓ Receive transcript JSON
  ↓ Return to Next.js
```

Command flow:
```bash
yt-dlp -f bestaudio -o - <VIDEO_URL> | \
ffmpeg -i pipe:0 -ac 1 -ar 16000 -f wav pipe:1 | \
curl -X POST Deepgram API
```

**Endpoints**:
- `GET /health` - Health check endpoint (returns 200 OK)
- `POST /transcribe` - Main transcription endpoint (requires HMAC signature)

**Security**:
- HMAC-SHA256 signature verification on all `/transcribe` requests
- Returns 401 if signature is missing or invalid
- Uses `crypto.timingSafeEqual()` to prevent timing attacks

**Dockerfile Details**:
- Base image: `node:20-slim`
- Installed: Python 3, yt-dlp, ffmpeg, Node.js
- Multi-stage build: Compile TypeScript → Prune devDependencies → Run as non-root user
- Health check: HTTP GET to `/health` every 30 seconds
- Optimized for Cloud Run / Fly.io deployment

**Docker Compose**:
- Runs Media Worker on port 3001
- Loads environment variables from `.env`
- Health check configured
- Isolated network for service-to-service communication

**Key Design Decisions**:
1. **Streaming Architecture**: Audio streams directly from yt-dlp → ffmpeg → Deepgram (no temp files)
2. **Express.js**: Simple HTTP server with minimal dependencies
3. **Non-root User**: Docker container runs as user `worker` (UID 1000) for security
4. **Deepgram Pre-recorded**: Uses `/v1/listen` endpoint (not WebSocket streaming)
5. **Error Handling**: Captures stderr from yt-dlp and ffmpeg for debugging

**Environment Variables**:
- `PORT` - Server port (default: 3001)
- `MEDIA_WORKER_SECRET` - Shared secret for HMAC verification
- `DEEPGRAM_API_KEY` - Deepgram API key

**Next Steps**: Phase 5 - Frontend UI

### Phase 5: Frontend UI
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `app/page.tsx` - Main page with "Check for new videos" button and transcript display
- `components/TranscriptCard.tsx` - Reusable transcript display component
- `components/VideoList.tsx` - Table view of recently processed videos

**UI Components**:

**1. Main Page (`app/page.tsx`)**:
- **Primary CTA**: Large "Check for new videos" button
- **Loading State**: Spinner animation during API call
- **Success Message**: Shows count of newly processed videos
- **Empty State**: Friendly message when no new videos found
- **Latest Transcript**: Displays most recent transcript (if any)
- **Video History**: Table of recently processed videos

Features:
- Client-side React component (`'use client'`)
- State management for loading, error, and result
- Auto-refresh video list after successful check
- Responsive design with Tailwind CSS
- Dark mode support

**2. Transcript Card Component**:
- **Header**: Video title (clickable link to YouTube), published date
- **Transcript Display**: Syntax-highlighted code block with full text
- **Expand/Collapse**: Shows first 300 characters, expandable to full text
- **Copy Button**: One-click copy to clipboard with visual feedback
- **Footer**: "Watch on YouTube" link with YouTube icon

Features:
- Collapsible long transcripts
- Copy-to-clipboard functionality
- Character count display
- Responsive card design

**3. Video List Component**:
- **Table View**: Title, Published Date, Duration, Status
- **Status Badges**: Color-coded badges (green=succeeded, red=failed, yellow=queued, blue=processing)
- **Loading State**: Spinner while fetching data
- **Empty State**: Message when no videos exist
- **Error Handling**: Displays error message if API fails

Features:
- Auto-fetches on mount via `useEffect`
- Clickable video titles link to YouTube
- Formatted dates and durations
- Hover effects on table rows
- Dark mode support

**Styling**:
- **Tailwind CSS**: Utility-first CSS framework
- **Color Palette**: Slate grays with blue accents
- **Dark Mode**: Full dark mode support with `dark:` prefixes
- **Responsive**: Mobile-friendly responsive design
- **Animations**: Smooth transitions, loading spinners, hover effects
- **Shadows**: Subtle shadows for depth

**User Experience Flow**:
1. User lands on page → sees "Check for new videos" button
2. Clicks button → Loading spinner appears
3. API processes videos → Success message shows count
4. Latest transcript displayed in expanded card
5. Video history table shows all processed videos
6. User can copy transcript, expand/collapse, click links to YouTube

**Key Design Decisions**:
1. **Client-Side Rendering**: Using `'use client'` for interactivity
2. **Single Page App**: All functionality on one page (no routing needed)
3. **Optimistic UI**: Shows loading states immediately
4. **Auto-Refresh**: Video list refreshes after processing new videos
5. **Accessibility**: Semantic HTML, focus states, keyboard navigation

**Next Steps**: Phase 6 - Documentation & Deployment

### Phase 6: Documentation & Deployment
**Date**: 2025-11-02
**Status**: ✅ Completed

**Files Created**:
- `README.md` - Comprehensive project documentation
- `vercel.json` - Vercel deployment configuration
- `media-worker/fly.toml` - Fly.io deployment configuration for Media Worker
- Git repository initialized and linked to GitHub

**README.md Contents**:
- Project overview and features
- Technology stack
- Architecture diagram
- Quick start guide
- Complete usage instructions
- API endpoint documentation
- Deployment guides (Vercel, Cloud Run, Fly.io)
- Environment variable reference
- Troubleshooting guide
- Cost estimates

**Deployment Configurations**:

**Vercel (Next.js App)**:
- Auto-detected Next.js framework
- Environment variable references via Vercel secrets
- Custom function timeout (5 minutes for `/api/check`)
- Region configuration (US East)

**Fly.io (Media Worker)**:
- Dockerfile-based build
- Auto-scaling (min 0, scales to demand)
- Health check endpoint configured
- 1 CPU, 1GB RAM
- HTTPS force enabled

**Git Repository**:
- Initialized with initial commit
- Linked to: `https://github.com/Atiwari330/youtube_auto_v1.git`
- Branch: `main`
- All files committed except `.env*` (gitignored)

**Deployment Steps**:
1. **Next.js → Vercel**: Push to GitHub, connect repo, add env vars, deploy
2. **Media Worker → Fly.io**: `fly launch`, `fly deploy`, set secrets
3. **Database → Supabase**: Run migration SQL in Supabase dashboard

**Next Steps**: Ready for production deployment!

### Phase 7: Testing & Polish
**Date**: 2025-11-02
**Status**: ✅ Completed

**Final Checklist**:
- [✅] All TypeScript files compile without errors
- [✅] Database schema validated and documented
- [✅] API endpoints defined and implemented
- [✅] Media Worker containerized and tested
- [✅] Frontend UI responsive and dark-mode enabled
- [✅] Environment variables documented
- [✅] Setup guide created
- [✅] Architecture documented
- [✅] Deployment configs created
- [✅] Git repository initialized

**Known Limitations (Future Enhancements)**:
1. **No WebSocket streaming**: Using pre-recorded mode only (simpler, more cost-effective)
2. **Sequential processing**: Videos processed one at a time (prevents API rate limiting)
3. **No word-level timings**: Storing full text only in Phase 1 (can be added later)
4. **Single channel**: Hardcoded to one YouTube channel (multi-channel support is out of scope)
5. **No background jobs**: Manual button-click operation (PubSubHubbub could be added later)

**Security Audit**:
- ✅ HMAC signature verification on Media Worker
- ✅ Environment variables never committed to Git
- ✅ Service role key used for Supabase (not anon key)
- ✅ Docker container runs as non-root user
- ✅ No hardcoded secrets in codebase

**Performance Considerations**:
- YouTube API quota: ~3-5 units per check (10,000 daily limit)
- Deepgram cost: ~$0.06 per 15-min video
- Supabase free tier: Sufficient for 100-500 transcripts
- Vercel free tier: Sufficient for moderate traffic

**Recommendation for Next Steps**:
1. Deploy to staging environment
2. Test with actual YouTube channel
3. Monitor Deepgram and YouTube API usage
4. Set up error alerting (e.g., Sentry)
5. Consider adding rate limiting for production

---

## Key Design Decisions

### Decision 1: Full Text Storage Only (No Segments)
**Rationale**: Smaller database payload, simpler implementation. Segments can be added later if needed for features like time-synced playback or SRT export.

### Decision 2: Media Worker in TypeScript
**Rationale**: Consistency with Next.js codebase. Easier to share types and utilities. Slightly more complex subprocess handling than Python, but worth it for unified stack.

### Decision 3: Deepgram Pre-recorded Mode
**Rationale**: Better throughput and cost control than streaming WebSocket. No need for real-time partials in batch processing UI.

### Decision 4: HMAC Signature for Media Worker
**Rationale**: Simple shared-secret authentication. No need for complex JWT/OAuth for internal service-to-service communication.

### Decision 5: No Background Jobs Initially
**Rationale**: One-button deterministic operation is simpler and more predictable. Background processing can be added in Phase 2+.

---

## Open Questions & Future Considerations

1. **Rate Limiting**: Should we implement rate limiting for YouTube API quota management?
2. **Concurrent Processing**: Process multiple videos in parallel or sequentially?
3. **Max Video Length**: Enforce hard limit (e.g., 2 hours) to prevent excessive costs?
4. **Segment Storage**: Add word-level timings later for SRT export?
5. **Reprocessing**: Should we expose an admin endpoint to reprocess failed videos?

---

## Dependencies & External Services

### Required API Keys
- YouTube Data API v3 (Google Cloud Console)
- Supabase Project (supabase.com)
- Deepgram API (deepgram.com)

### Service Dependencies
- yt-dlp (video downloading)
- ffmpeg (audio conversion)
- Docker (containerization)

---

_This document will be continuously updated throughout the build process to reflect actual implementation details, decisions, and learnings._
