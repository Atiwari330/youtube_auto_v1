# YouTube Transcript Automation

A one-button web application that automatically transcribes new YouTube videos from a specified channel using Deepgram's speech-to-text API.

## Features

- **One-Click Operation**: Single button to check for and process new videos
- **Automatic Transcription**: Uses Deepgram STT for accurate transcriptions
- **Idempotent Processing**: Won't duplicate transcripts for already-processed videos
- **Full-Text Search**: Store and display complete transcripts
- **Video History**: View all recently processed videos
- **Responsive UI**: Modern, dark-mode-enabled interface

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Transcription**: Deepgram API
- **Media Processing**: Docker service with yt-dlp + ffmpeg
- **Deployment**: Vercel (Next.js), Cloud Run/Fly.io (Media Worker)

## Architecture

```
┌─────────┐      ┌──────────────┐      ┌──────────┐
│ Browser │─────→│  Next.js App │─────→│ YouTube  │
└─────────┘      │  (Vercel)    │      │   API    │
                 └──────┬───────┘      └──────────┘
                        │
                        ├─────→ Supabase (Videos + Transcripts)
                        │
                        └─────→ Media Worker (Docker)
                                    │
                                    ├→ yt-dlp (audio extraction)
                                    ├→ ffmpeg (audio conversion)
                                    └→ Deepgram (STT)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for Media Worker)
- YouTube Data API key
- Supabase project
- Deepgram API key

### 1. Clone the Repository

```bash
git clone https://github.com/Atiwari330/youtube_auto_v1.git
cd youtube_auto_v1
```

### 2. Install Dependencies

```bash
npm install
cd media-worker && npm install && cd ..
```

### 3. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your credentials:
- YouTube API Key
- YouTube Channel ID
- Supabase URL and Service Role Key
- Deepgram API Key
- Media Worker URL and Secret

See [SETUP.md](SETUP.md) for detailed instructions on obtaining these credentials.

### 4. Set Up Database

1. Go to your Supabase project
2. Open SQL Editor
3. Run the migration: `supabase/migrations/001_initial_schema.sql`

### 5. Start Media Worker

```bash
# Using Docker Compose (recommended)
docker-compose up

# OR manually
cd media-worker
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### 6. Start Next.js Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Usage

1. **Click "Check for new videos"** - The app will:
   - Fetch the latest videos from your YouTube channel
   - Compare against already-processed videos in the database
   - For each new video:
     - Extract audio using yt-dlp + ffmpeg
     - Transcribe via Deepgram
     - Store transcript in Supabase
2. **View Latest Transcript** - Displayed immediately after processing
3. **Browse Video History** - See all previously processed videos

## Project Structure

```
youtube_auto_v1/
├── app/
│   ├── api/
│   │   ├── check/          # Main endpoint: check for new videos
│   │   ├── transcripts/    # Fetch latest transcript
│   │   └── videos/         # List processed videos
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Main UI
├── components/
│   ├── TranscriptCard.tsx  # Transcript display component
│   └── VideoList.tsx       # Video history table
├── lib/
│   ├── supabase.ts         # Database utilities
│   ├── youtube.ts          # YouTube API integration
│   ├── media-worker-client.ts  # Media Worker HTTP client
│   └── types.ts            # TypeScript interfaces
├── media-worker/
│   ├── src/
│   │   └── index.ts        # Express server with /transcribe endpoint
│   ├── Dockerfile
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.local.example
├── SETUP.md
├── ARCHITECTURE.md
├── PRD.md
└── README.md
```

## API Endpoints

### Next.js API Routes

#### `POST /api/check`

Check for new YouTube videos and transcribe them.

**Request**:
```json
{
  "limit": 5  // Optional: number of recent videos to check
}
```

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

Fetch the most recent successful transcript.

#### `GET /api/videos?limit=10`

List recently processed videos.

### Media Worker API

#### `POST /transcribe`

Transcribe a YouTube video (requires HMAC signature).

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

## Deployment

### Next.js App (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Media Worker (Cloud Run)

```bash
cd media-worker

# Build and push Docker image
docker build -t gcr.io/YOUR_PROJECT/media-worker .
docker push gcr.io/YOUR_PROJECT/media-worker

# Deploy to Cloud Run
gcloud run deploy media-worker \
  --image gcr.io/YOUR_PROJECT/media-worker \
  --platform managed \
  --region us-central1 \
  --set-env-vars MEDIA_WORKER_SECRET=xxx,DEEPGRAM_API_KEY=xxx
```

### Media Worker (Fly.io)

```bash
cd media-worker
fly launch
fly deploy
```

Update your Next.js `.env.local` with the deployed Media Worker URL.

## Environment Variables

### Next.js (.env.local)

```bash
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPGRAM_API_KEY=
MEDIA_WORKER_URL=
MEDIA_WORKER_SECRET=
LANG_HINT=en
```

### Media Worker (.env)

```bash
MEDIA_WORKER_SECRET=
DEEPGRAM_API_KEY=
PORT=3001
```

## Security

- **HMAC Signatures**: All Media Worker requests are signed with HMAC-SHA256
- **Environment Variables**: All secrets stored in environment variables (not committed)
- **Service Role Key**: Uses Supabase service role key for server-side operations
- **Non-Root Docker**: Media Worker runs as non-root user

## Cost Estimates

- **YouTube Data API**: Free (10,000 quota units/day)
- **Supabase**: Free tier (500MB database)
- **Deepgram**: $200 free credits (~45 hours of audio)
- **Vercel**: Free tier (100GB bandwidth)
- **Cloud Run/Fly.io**: ~$5-10/month (depending on usage)

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions for obtaining API keys
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and design decisions
- [PRD.md](PRD.md) - Original product requirements document

## Troubleshooting

### YouTube API Errors

- **Quota exceeded**: Wait until midnight Pacific Time or request quota increase
- **Invalid API key**: Verify key in Google Cloud Console

### Supabase Errors

- **Invalid API key**: Ensure you're using `service_role` key, not `anon` key
- **Table not found**: Run database migrations

### Media Worker Errors

- **Connection refused**: Ensure Docker container is running on port 3001
- **Invalid signature**: Verify `MEDIA_WORKER_SECRET` matches in both `.env.local` and `media-worker/.env`

### Deepgram Errors

- **Invalid credentials**: Check API key in Deepgram Console
- **Insufficient balance**: Add payment method or purchase credits

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - PostgreSQL database
- [Deepgram](https://deepgram.com/) - Speech-to-text API
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube video downloader
- [ffmpeg](https://ffmpeg.org/) - Media processing
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

## Support

For issues and questions:
- GitHub Issues: [https://github.com/Atiwari330/youtube_auto_v1/issues](https://github.com/Atiwari330/youtube_auto_v1/issues)
- Documentation: See [SETUP.md](SETUP.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
