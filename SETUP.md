# Setup Guide - YouTube Transcript Automation

This guide will walk you through obtaining all necessary API keys and credentials to run the YouTube Transcript Automation tool.

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Docker (for running the Media Worker)
- A Google account
- A Supabase account
- A Deepgram account

---

## Step 1: YouTube Data API Key

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "YouTube Transcript Tool")
4. Click "Create"

### 1.2 Enable YouTube Data API v3

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "YouTube Data API v3"
3. Click on it and press **Enable**

### 1.3 Create API Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the generated API key
4. (Optional but recommended) Click "Restrict Key":
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3"
   - Click "Save"

### 1.4 Find Your YouTube Channel ID

**Method 1: From Channel URL**
- If your channel URL is `https://www.youtube.com/@YourChannelName`, you need the channel ID
- Go to your channel page
- Click "About" tab
- Click "Share channel" → "Copy channel ID"

**Method 2: Using YouTube Advanced Settings**
- Go to [YouTube Studio](https://studio.youtube.com/)
- Click "Settings" (bottom left)
- Click "Channel" → "Advanced settings"
- Your Channel ID is listed there

**Method 3: Use an API call**
- Once you have your API key, you can find the channel ID by username:
```bash
curl "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@YourUsername&key=YOUR_API_KEY"
```

### 1.5 Update Environment Variables

Add to your `.env.local`:
```bash
YOUTUBE_API_KEY=AIza...your_api_key
YOUTUBE_CHANNEL_ID=UCx...your_channel_id
```

---

## Step 2: Supabase Setup

### 2.1 Create a Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Click "Start your project" or "New Project"
3. Sign in with GitHub or email
4. Click "New project"
5. Choose your organization (or create one)
6. Enter project details:
   - **Name**: youtube-transcripts
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to you
7. Click "Create new project"
8. Wait ~2 minutes for provisioning

### 2.2 Get Supabase Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (for client-side, not needed for this project)
   - **service_role secret** key (for server-side operations)

⚠️ **Important**: Use the `service_role` key, not the `anon` key, for server-side operations.

### 2.3 Run Database Migrations

1. In your Supabase project, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the migration SQL from `supabase/migrations/001_initial_schema.sql` (we'll create this later)
4. Click "Run"

**OR** use the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### 2.4 Update Environment Variables

Add to your `.env.local`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_role_key
```

---

## Step 3: Deepgram API Key

### 3.1 Create a Deepgram Account

1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Click "Sign Up" or "Get Started"
3. Sign up with email or GitHub
4. Verify your email address

### 3.2 Get Free Credits

Deepgram offers $200 in free credits to start. No credit card required for initial signup.

### 3.3 Create an API Key

1. In the Deepgram Console, go to **API Keys** (left sidebar)
2. Click "Create a New API Key"
3. Enter a name (e.g., "YouTube Transcription")
4. Set permissions: **Read/Write** (or use default)
5. Click "Create Key"
6. Copy the API key immediately (it won't be shown again)

### 3.4 Update Environment Variables

Add to your `.env.local`:
```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

---

## Step 4: Media Worker Secret

### 4.1 Generate a Strong Secret

This is a shared secret used for HMAC signature verification between the Next.js app and the Media Worker.

**Option 1: Using OpenSSL (Linux/Mac/Git Bash)**
```bash
openssl rand -hex 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: Using an Online Generator**
- Visit a password generator like [RandomKeygen](https://randomkeygen.com/)
- Use a "CodeIgniter Encryption Key" or similar 256-bit key

### 4.2 Update Environment Variables

Add the SAME secret to both:

**`.env.local` (Next.js):**
```bash
MEDIA_WORKER_SECRET=your_generated_secret_here
```

**`media-worker/.env` (Media Worker):**
```bash
MEDIA_WORKER_SECRET=your_generated_secret_here
```

---

## Step 5: Media Worker URL

### 5.1 For Local Development

Add to your `.env.local`:
```bash
MEDIA_WORKER_URL=http://localhost:3001
```

### 5.2 For Production

After deploying the Media Worker to Cloud Run, Fly.io, or Railway, update:
```bash
MEDIA_WORKER_URL=https://your-media-worker.fly.dev
```

---

## Step 6: Final Environment Setup

### 6.1 Create `.env.local`

Copy the example file and fill in your credentials:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual values.

### 6.2 Verify Your Setup

Your `.env.local` should look like:
```bash
# YouTube
YOUTUBE_API_KEY=AIzaSy...
YOUTUBE_CHANNEL_ID=UCx...

# Supabase
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Deepgram
DEEPGRAM_API_KEY=abc123...

# Media Worker
MEDIA_WORKER_URL=http://localhost:3001
MEDIA_WORKER_SECRET=a1b2c3d4e5f6...

# Optional
LANG_HINT=en
```

---

## Step 7: Database Setup

### 7.1 Run Migrations

Navigate to your Supabase project and run the SQL migrations:

1. Go to **SQL Editor** in Supabase dashboard
2. Run the migration file: `supabase/migrations/001_initial_schema.sql`

This creates:
- `videos` table
- `transcripts` table
- Required indexes

### 7.2 Verify Tables

In Supabase, go to **Table Editor** and verify you see:
- `videos` table
- `transcripts` table

---

## Step 8: Install Dependencies

### 8.1 Install Next.js Dependencies

```bash
npm install
```

### 8.2 Install Media Worker Dependencies

```bash
cd media-worker
npm install
cd ..
```

---

## Step 9: Start Development Servers

### Option 1: Using Docker Compose (Recommended)

```bash
docker-compose up
```

This starts both the Next.js app and the Media Worker.

### Option 2: Manual Start

**Terminal 1 - Next.js App:**
```bash
npm run dev
```

**Terminal 2 - Media Worker:**
```bash
cd media-worker
npm run dev
```

---

## Step 10: Test Your Setup

1. Open your browser to [http://localhost:3000](http://localhost:3000)
2. You should see the YouTube Transcript Automation UI
3. Click "Check for new videos"
4. If everything is configured correctly:
   - The app will check your YouTube channel
   - Process any new videos
   - Display transcripts

---

## Troubleshooting

### YouTube API Errors

**Error: "The request cannot be completed because you have exceeded your quota."**
- YouTube Data API has a daily quota of 10,000 units
- Each `playlistItems.list` call costs ~3-5 units
- Reset: Wait until midnight Pacific Time
- Solution: Request quota increase in Google Cloud Console

**Error: "API key not valid"**
- Double-check your API key in `.env.local`
- Ensure the YouTube Data API v3 is enabled
- Verify API key restrictions aren't blocking localhost

### Supabase Errors

**Error: "Invalid API key"**
- Ensure you're using the `service_role` key, not `anon` key
- Check for extra spaces or newlines in `.env.local`

**Error: "relation 'videos' does not exist"**
- Run the database migrations in SQL Editor
- Verify tables exist in Table Editor

### Deepgram Errors

**Error: "Invalid credentials"**
- Verify your Deepgram API key is correct
- Check if you have remaining credits in the Deepgram Console

**Error: "Insufficient balance"**
- You've used all your free credits
- Add payment method or purchase more credits

### Media Worker Errors

**Error: "Connection refused" or "ECONNREFUSED"**
- Ensure the Media Worker is running on port 3001
- Check `MEDIA_WORKER_URL` in `.env.local`
- Verify Docker is running (if using Docker)

**Error: "Invalid signature"**
- Ensure `MEDIA_WORKER_SECRET` is the same in both `.env.local` and `media-worker/.env`

---

## Security Notes

1. **Never commit `.env.local` or `.env` files** to version control
2. `.gitignore` already excludes these files
3. Rotate API keys if accidentally exposed
4. Use environment variables in production (Vercel, Cloud Run, etc.)
5. Set up Supabase RLS (Row Level Security) policies for production

---

## Cost Considerations

### YouTube Data API
- **Free tier**: 10,000 quota units/day
- Typical usage: ~50-100 video checks per day
- **Cost**: Free for most use cases

### Supabase
- **Free tier**: 500MB database, 1GB bandwidth, 2GB file storage
- Typical usage: ~100-500 transcripts
- **Cost**: Free for small projects

### Deepgram
- **Free tier**: $200 credits (~45 hours of audio)
- **Pay-as-you-go**: $0.0043/minute (pre-recorded)
- Typical 15-min video: ~$0.06
- **Monthly estimate**: $5-20 depending on volume

---

## Next Steps

Once setup is complete:
1. Read the [README.md](README.md) for usage instructions
2. Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
3. Review [PRD.md](PRD.md) for product requirements

---

## Getting Help

If you encounter issues:
1. Check this SETUP guide thoroughly
2. Review error logs in the console
3. Verify all environment variables are set correctly
4. Consult the official documentation:
   - [YouTube Data API Docs](https://developers.google.com/youtube/v3)
   - [Supabase Docs](https://supabase.com/docs)
   - [Deepgram Docs](https://developers.deepgram.com/)

Happy transcribing!
