# YouTube Fantasy Basketball Automation Plan

## Vision Statement
Transform the manual YouTube video processing UI into a fully automated system that:
- Automatically detects new videos from specified YouTube channels
- Transcribes video content without manual intervention
- Analyzes transcripts using AI to identify fantasy basketball insights
- Sends Discord notifications for high-urgency player pickups
- Operates on an hourly polling schedule with zero manual intervention required

**Important:** All automation is additive - existing manual UI functionality remains completely intact and operational.

---

## Current System Architecture

### Tech Stack
**Frontend/Backend:**
- Next.js 15 (App Router) with React 19 and TypeScript
- Tailwind CSS for styling with dark mode support
- Vercel AI SDK (version 5.0.86) for AI agents
- Zod for schema validation

**Database & APIs:**
- Supabase (PostgreSQL) for video/transcript/analysis storage
- YouTube Data API v3 for fetching channel uploads
- Deepgram API for speech-to-text transcription
- OpenAI GPT-5 for fantasy basketball AI analysis (via Vercel AI SDK)

**Media Processing:**
- Standalone Media Worker (Express.js server on Node.js)
- yt-dlp for audio extraction from YouTube
- ffmpeg for audio format conversion (to mono 16kHz WAV)
- HMAC-SHA256 signature authentication between Next.js and Media Worker

**Deployment:**
- Next.js: Vercel
- Media Worker: Dockerized, ready for Cloud Run/Fly.io
- Database: Supabase cloud

### Current Manual Workflow
1. User manually clicks "Fetch Recent Videos" button
2. System saves new videos with status='queued'
3. User manually clicks "Transcribe" on each queued video
4. User manually clicks AI agent buttons for analysis (Must-Roster, Watch List, Drop, Injury Return)
5. User views results in UI

### Data Flow Pipeline
```
YouTube API → Fetch Videos → Save as 'queued' → Transcribe → AI Analysis → Display Results
```

**Detailed Processing:**
1. **Fetch Videos:** YouTube Data API v3 → Supabase (status='queued')
2. **Transcription:**
   - Next.js → Media Worker (HMAC-signed request)
   - Media Worker: yt-dlp extracts audio → ffmpeg converts → Deepgram transcribes
   - Returns transcript → Stored in Supabase
   - Update status='succeeded'
3. **AI Analysis:**
   - Fetch transcript from database
   - GPT-5 analyzes with specialized agent prompt
   - Returns structured JSON (Zod validated)
   - Store in Supabase analysis table

### Database Schema
**videos table:**
- id (text, PK) - YouTube video ID
- title (text)
- published_at (timestamptz)
- duration_sec (int, nullable)
- status (text) - 'queued' | 'processing' | 'succeeded' | 'failed'
- processed_at (timestamptz, nullable)
- notes (text, nullable)
- created_at (timestamptz)

**transcripts table:**
- video_id (text, PK, FK → videos.id)
- source (text) - 'deepgram'
- language (text, nullable)
- text (text)
- segments (jsonb, nullable)
- created_at (timestamptz)

**analysis table:**
- id (uuid, PK)
- video_id (text, FK → videos.id)
- agent_type (text) - 'must_roster' | 'watch_list' | 'drop' | 'injury_return'
- players (jsonb)
- summary (text)
- confidence (text) - 'HIGH' | 'MEDIUM' | 'LOW'
- raw_response (text, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
- UNIQUE constraint on (video_id, agent_type)

### Four AI Agents
1. **Must-Roster Agent** - Identifies urgent pickups (PRIMARY for automation)
2. **Watch List Agent** - Players to monitor
3. **Drop Agent** - Drop candidates
4. **Injury Return Agent** - Players returning from injury

Each agent uses GPT-5 via Vercel AI SDK with specialized prompts and Zod schemas for structured output.

---

## Automation Requirements

### User Preferences (Selected)
- **Check Frequency:** Every hour
- **Auto Analysis:** Must-Roster agent only
- **Notification Trigger:** HIGH urgency players only
- **Infrastructure:** Vercel Cron

### Automation Goals
1. Hourly check for new YouTube videos
2. Automatic transcription of new videos
3. Automatic Must-Roster AI analysis
4. Discord notification when HIGH urgency players are identified
5. All processing happens server-side with zero manual intervention
6. Existing manual UI remains fully functional

---

## Implementation Plan

### Phase 1: Discord Integration

**Create:** `lib/discord.ts`

**Purpose:** Discord webhook client for sending notifications

**Features:**
- Send formatted embed messages with player information
- Include video title, link, player names, urgency levels, reasoning quotes
- Error handling and retry logic
- Type-safe interfaces for Discord webhook payloads

**Environment Variable Required:**
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for notifications

---

### Phase 2: Automation Endpoint

**Create:** `app/api/cron/process-new-videos/route.ts`

**Purpose:** Main automation orchestration endpoint (invoked by Vercel Cron)

**Workflow:**
1. **Fetch New Videos**
   - Call `fetchRecentVideos()` from `lib/youtube.ts`
   - Save new videos to database with status='queued'
   - Log count of new videos found

2. **Process Queued Videos**
   - Query database for all videos with status='queued'
   - For each queued video:
     - Update status to 'processing'
     - Transcribe via Media Worker (reuse `lib/media-worker-client.ts`)
     - If transcription succeeds:
       - Run Must-Roster AI agent (reuse `lib/agents/must-roster.ts`)
       - Parse results for HIGH urgency players
       - If HIGH urgency players found → Send Discord notification
       - Update status to 'succeeded'
     - If transcription fails:
       - Update status to 'failed' with error notes
       - Continue to next video (graceful degradation)

3. **Return Summary**
   - Videos fetched
   - Videos processed
   - Transcriptions succeeded/failed
   - Players found
   - Notifications sent

**Security:**
- Verify Vercel cron secret in request headers
- Reject unauthorized requests

**Error Handling:**
- Try-catch blocks for each video (one failure doesn't stop batch)
- Log all errors to console
- Optional: Send Discord notification for system errors

**Timeout:**
- Set to 5 minutes via route config to handle multiple videos

---

### Phase 3: Vercel Cron Configuration

**Modify:** `vercel.json`

**Add Cron Schedule:**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-new-videos",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule Format:** `0 * * * *` = Every hour at minute :00

**Add Route Config (if needed):**
```json
{
  "routes": [
    {
      "src": "/api/cron/process-new-videos",
      "methods": ["GET", "POST"],
      "headers": {
        "cache-control": "no-store"
      }
    }
  ]
}
```

---

### Phase 4: Environment Variables

**Add to Vercel Project Settings:**
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for notifications
- `CRON_SECRET` - Auto-generated by Vercel for cron authentication

**Add to `.env.local` (for local testing):**
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
CRON_SECRET=your-local-test-secret
```

---

### Phase 5: Optional Enhancements (Future)

**UI Updates (Optional):**
- Display "Last Auto-Check" timestamp on main page
- Add automation status dashboard showing:
  - Recent cron runs
  - Success/failure rates
  - Processing queue status
- Add toggle to enable/disable automation (without redeployment)

**Advanced Features (Future):**
- Run additional AI agents (Watch List, Drop, Injury Return) on schedule
- Configurable notification thresholds (HIGH + MEDIUM urgency)
- Email notifications as alternative to Discord
- Retry failed transcriptions automatically
- YouTube PubSubHubbub webhook for real-time video detection (eliminates polling)

---

## Files to Create/Modify

### New Files
1. `lib/discord.ts` - Discord webhook integration
2. `app/api/cron/process-new-videos/route.ts` - Main automation endpoint

### Modified Files
1. `vercel.json` - Add cron schedule configuration
2. `.env.local` - Add Discord webhook URL (for local testing)

### No Changes Required
- All existing UI components
- All existing API routes (`/api/check`, `/api/transcribe/*`, `/api/analysis/*`)
- All existing library functions (`lib/youtube.ts`, `lib/media-worker-client.ts`, `lib/agents/*`)
- Database schema
- Media Worker service

---

## Key Design Principles

### 1. Non-Breaking Changes
- All automation is additive
- Existing manual UI workflow remains fully functional
- No modifications to existing API routes or library functions
- Database schema unchanged

### 2. Code Reuse
- Automation calls existing functions (doesn't duplicate logic)
- Same transcription pipeline (Next.js → Media Worker → Deepgram)
- Same AI agents (mustRosterAgent from existing lib)
- Same database operations (Supabase client)

### 3. Graceful Degradation
- One video failure doesn't stop batch processing
- Continue processing remaining videos
- Log all errors for debugging
- Update status appropriately for each video

### 4. Security
- Vercel cron secret verification
- HMAC-signed Media Worker requests (existing)
- Discord webhook URL in environment variables (not hardcoded)

### 5. Observability
- Comprehensive logging (videos fetched, processed, analyzed)
- Discord notifications for high-urgency findings
- Optional: Discord notifications for system errors
- Return detailed summary from cron endpoint

---

## Testing Plan

### Local Testing
1. Set up `.env.local` with Discord webhook URL
2. Test Discord integration independently (`lib/discord.ts`)
3. Test cron endpoint locally via direct HTTP call
4. Verify existing UI still works (manual workflow)

### Staging/Production Testing
1. Deploy to Vercel
2. Manually trigger cron endpoint via Vercel dashboard
3. Verify Discord notification received
4. Wait for scheduled cron execution
5. Monitor Vercel logs for errors

### Validation Checklist
- [ ] New videos detected and saved to database
- [ ] Videos automatically transcribed
- [ ] Must-Roster analysis runs automatically
- [ ] Discord notification sent for HIGH urgency players
- [ ] Existing manual UI still functional
- [ ] No errors in Vercel logs
- [ ] Media Worker processing correctly

---

## Deployment Steps

1. **Create Discord Webhook:**
   - Go to Discord Server Settings → Integrations → Webhooks
   - Create new webhook for target channel
   - Copy webhook URL

2. **Add Environment Variables:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Add `DISCORD_WEBHOOK_URL`
   - Vercel auto-generates `CRON_SECRET` when cron is configured

3. **Deploy Code:**
   - Commit new files (`lib/discord.ts`, `app/api/cron/process-new-videos/route.ts`)
   - Commit modified `vercel.json`
   - Push to GitHub
   - Vercel auto-deploys

4. **Verify Cron Setup:**
   - Vercel Dashboard → Project → Settings → Cron Jobs
   - Confirm schedule shows "0 * * * *"
   - Manually trigger test run if available

5. **Monitor First Execution:**
   - Wait for next hour mark (:00)
   - Check Vercel logs for execution
   - Check Discord channel for notification
   - Verify database for processed videos

---

## Maintenance & Monitoring

### Regular Checks
- Monitor Discord notifications for unexpected patterns
- Review Vercel logs weekly for errors
- Check YouTube API quota usage (10,000 units/day free tier)
- Verify Media Worker uptime and health

### Common Issues & Solutions
- **No new videos detected:** Check YouTube channel posting schedule, verify API key
- **Transcription failures:** Check Media Worker logs, verify yt-dlp/ffmpeg availability
- **AI analysis errors:** Check OpenAI API key, verify quota limits
- **Discord notifications not sent:** Verify webhook URL, check Discord server settings

### Scaling Considerations
- **Multiple channels:** Add channel_id parameter, loop through channels in cron
- **High volume:** Add job queue (BullMQ, Inngest) for parallel processing
- **Cost optimization:** Adjust check frequency based on channel posting patterns

---

## Success Metrics

- **Automation Reliability:** 95%+ successful video processing rate
- **Timeliness:** New videos detected and processed within 2 hours of publication
- **Notification Accuracy:** Only HIGH urgency players trigger Discord notifications
- **Zero Manual Intervention:** System runs autonomously for weeks without manual triggering

---

## Future Vision

This automation lays the foundation for:
- Multi-channel support (multiple fantasy basketball sources)
- Advanced scheduling (different frequencies per channel)
- Machine learning insights (trend detection, player performance predictions)
- Mobile app integration (push notifications)
- Community features (shared watchlists, collaborative analysis)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-04
**Status:** Planning Phase - Ready for Implementation
