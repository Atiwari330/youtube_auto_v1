# Automation Deployment Guide

This guide will help you deploy and test the YouTube Fantasy Basketball automation system.

## What Was Built

The following files were created/modified to enable full automation:

### New Files Created
1. **`lib/discord.ts`** - Discord webhook integration for notifications
2. **`app/api/cron/process-new-videos/route.ts`** - Main automation endpoint

### Files Modified
1. **`vercel.json`** - Added cron schedule and Discord webhook env var
2. **`.env.local`** - Added Discord webhook URL and cron secret placeholders

## How It Works

### Automated Workflow
Every hour (at :00), Vercel Cron will trigger the automation:

1. **Fetch Videos** - Checks YouTube for new videos from your channel
2. **Save New Videos** - Saves new videos to database as 'queued'
3. **Process Queue** - For each queued video:
   - Transcribes the audio using Deepgram
   - Runs Must-Roster AI agent to find urgent pickups
   - If HIGH urgency players are found → sends Discord notification
4. **Summary** - Returns processing summary with stats

### What Gets Sent to Discord

When HIGH urgency players are detected, you'll receive a Discord embed with:
- Video title and link
- Player names with urgency levels
- Reasoning quotes from the transcript
- Team, position, roster percentage (if available)
- Analysis confidence level

## Setup Instructions

### 1. Create Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it (e.g., "Fantasy Basketball Bot")
5. Select the channel where you want notifications
6. Click **Copy Webhook URL**

### 2. Update Environment Variables

#### For Local Development (.env.local)

Replace the placeholder in `.env.local`:

```bash
# Replace this line:
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# With your actual webhook URL:
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/abcdefg...
```

The `CRON_SECRET` can stay as is for local testing.

#### For Vercel Production

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `DISCORD_WEBHOOK_URL`
   - **Value:** Your Discord webhook URL (paste from step 1)
   - **Environment:** Production, Preview, Development (select all)
4. Click **Save**

**Note:** Vercel automatically generates `CRON_SECRET` when you deploy with a cron configuration, so you don't need to add it manually.

### 3. Test Locally (Optional)

Before deploying, you can test the automation endpoint locally:

#### Step 1: Start your development server
```bash
npm run dev
```

#### Step 2: In a separate terminal, trigger the endpoint manually
```bash
curl -X GET http://localhost:3000/api/cron/process-new-videos \
  -H "Authorization: Bearer local-dev-secret-change-in-production"
```

**What to expect:**
- The endpoint will fetch recent videos
- Process any queued videos
- If HIGH urgency players are found, you'll get a Discord notification
- Check the terminal logs for detailed processing info

**Note:** For local testing, make sure your Media Worker is running on `http://localhost:3001`.

### 4. Deploy to Vercel

Once you're ready to deploy:

```bash
# Commit your changes (if not already done)
git add .
git commit -m "Add automation system with Discord notifications"
git push origin feature/automation
```

Then either:
- **Option A:** Merge to main and let Vercel auto-deploy
- **Option B:** Create a pull request and merge after review

### 5. Verify Cron Setup in Vercel

After deployment:

1. Go to Vercel Dashboard → Your Project
2. Navigate to **Settings** → **Cron Jobs**
3. You should see:
   - **Path:** `/api/cron/process-new-videos`
   - **Schedule:** `0 * * * *` (every hour)
   - **Status:** Active

### 6. Manually Trigger Cron (First Test)

To test without waiting for the hourly schedule:

1. In Vercel Dashboard → **Deployments**
2. Click on your latest deployment
3. Go to **Functions** tab
4. Find `/api/cron/process-new-videos`
5. Click **Trigger** or **Invoke** (if available)

Alternatively, wait for the next hour mark (e.g., 2:00 PM, 3:00 PM) and the cron will run automatically.

### 7. Monitor Execution

#### Check Vercel Logs
1. Vercel Dashboard → Your Project → **Logs**
2. Filter by function: `/api/cron/process-new-videos`
3. Look for log entries starting with `[cron]`

#### Check Discord Channel
You should receive a notification if:
- New video was found and processed
- Must-Roster agent found HIGH urgency players

#### Check Database (Supabase)
1. Go to Supabase Dashboard → Your Project
2. Navigate to **Table Editor**
3. Check the `videos`, `transcripts`, and `analysis` tables for new entries

## Troubleshooting

### No Discord Notifications Received

**Possible causes:**
1. `DISCORD_WEBHOOK_URL` not set correctly in Vercel
   - **Fix:** Double-check the environment variable in Vercel Settings
2. No HIGH urgency players found in the video
   - **Fix:** Check Vercel logs to see analysis results
3. Discord webhook URL is invalid
   - **Fix:** Test the webhook by sending a test message

**Test Discord webhook manually:**
```bash
curl -X POST "YOUR_DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message from automation system"}'
```

### Cron Not Running

**Possible causes:**
1. Vercel cron not configured correctly
   - **Fix:** Check `vercel.json` has the `crons` section
2. Deployment failed
   - **Fix:** Check Vercel deployment logs for errors
3. Free tier limitations
   - **Fix:** Verify your Vercel plan supports cron jobs

### Transcription Failures

**Possible causes:**
1. Media Worker is down
   - **Fix:** Check Media Worker health at `MEDIA_WORKER_URL/health`
2. Video is too long (>30 minutes)
   - **Fix:** The system already has a 30-minute timeout, but very long videos may fail
3. YouTube video is unavailable or private
   - **Fix:** Check video accessibility

**Check Media Worker logs:**
If deployed on Fly.io or Cloud Run, check those platform logs for errors.

### Authorization Errors (401)

**Possible causes:**
1. `CRON_SECRET` mismatch
   - **Fix:** In production, Vercel auto-generates this. Don't manually set it in environment variables.
2. Unauthorized request
   - **Fix:** Only Vercel Cron can trigger this endpoint (by design for security)

## Testing the Discord Integration Standalone

You can test the Discord integration without running the full automation:

Create a test script `test-discord.ts`:
```typescript
import { testDiscordWebhook } from './lib/discord'

async function main() {
  const success = await testDiscordWebhook()
  console.log(success ? 'Discord webhook is working!' : 'Discord webhook failed')
}

main()
```

Run it:
```bash
npx tsx test-discord.ts
```

## Next Steps

### Optional Enhancements

1. **Add More Agents**
   - Modify the cron endpoint to run Watch List, Drop, or Injury Return agents
   - Update Discord notification logic accordingly

2. **Customize Schedule**
   - Change `"0 * * * *"` in `vercel.json` to a different cron expression
   - Examples:
     - Every 6 hours: `"0 */6 * * *"`
     - Twice daily (9 AM and 9 PM UTC): `"0 9,21 * * *"`
     - Once daily at midnight: `"0 0 * * *"`

3. **Add Email Notifications**
   - Install a mail service (SendGrid, Resend, etc.)
   - Create `lib/email.ts` similar to `lib/discord.ts`
   - Call email notification alongside Discord

4. **Add Notification Preferences**
   - Create a config file or database table for notification settings
   - Let users toggle notifications for MEDIUM urgency players
   - Filter by specific teams or positions

5. **Monitor Multiple Channels**
   - Add a `channels` array to the cron endpoint
   - Loop through channels and process each one
   - Track channel ID in database for proper attribution

## Success Criteria

✅ **Automation is working correctly when:**
- New videos are automatically detected and saved to database
- Videos are automatically transcribed without manual intervention
- Must-Roster analysis runs automatically after transcription
- Discord notifications arrive when HIGH urgency players are found
- No manual clicking required - everything happens in the background

## Maintenance

### Weekly Checks
- Review Discord notifications for accuracy
- Check Vercel logs for any errors
- Verify database is not growing too large

### Monthly Checks
- Review YouTube API quota usage (10,000 units/day free)
- Check Deepgram usage and costs
- Monitor OpenAI API usage for GPT-5 calls
- Verify Media Worker uptime

### Database Cleanup (Optional)
If you want to clean up old data:
```sql
-- Delete analysis older than 30 days
DELETE FROM analysis WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete transcripts for failed videos
DELETE FROM transcripts WHERE video_id IN (
  SELECT id FROM videos WHERE status = 'failed'
);
```

## Support

If you encounter issues:
1. Check Vercel logs first (most issues show up here)
2. Verify all environment variables are set correctly
3. Test each component individually (Discord webhook, Media Worker, etc.)
4. Review the `AUTOMATION_PLAN.md` for architecture details

---

**Last Updated:** 2025-11-04
**System Status:** Ready for deployment
