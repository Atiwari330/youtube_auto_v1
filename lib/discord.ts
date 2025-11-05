/**
 * Discord Webhook Integration
 *
 * Sends formatted notifications to Discord for high-urgency fantasy basketball player pickups.
 */

interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

interface DiscordEmbed {
  title: string
  description?: string
  url?: string
  color: number
  fields?: DiscordEmbedField[]
  timestamp?: string
  footer?: {
    text: string
  }
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

interface Player {
  name: string
  team?: string
  position?: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning: string
  roster_percentage?: number
  context?: string
}

interface NotificationData {
  videoId: string
  videoTitle: string
  players: Player[]
  summary: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * Send a Discord notification for high-urgency player pickups
 */
export async function sendPlayerNotification(data: NotificationData): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('[Discord] DISCORD_WEBHOOK_URL not configured - skipping notification')
    return
  }

  try {
    const embed = createPlayerEmbed(data)
    const payload: DiscordWebhookPayload = {
      content: '🏀 **New Fantasy Basketball Alert!**',
      embeds: [embed],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Discord API error: ${response.status} - ${errorText}`)
    }

    console.log(`[Discord] Notification sent successfully for video: ${data.videoId}`)
  } catch (error) {
    console.error('[Discord] Failed to send notification:', error)
    // Don't throw - we don't want Discord failures to break the automation pipeline
  }
}

/**
 * Send an error notification to Discord
 */
export async function sendErrorNotification(errorMessage: string, context?: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    return
  }

  try {
    const embed: DiscordEmbed = {
      title: '⚠️ Automation Error',
      description: errorMessage,
      color: 0xFF0000, // Red
      fields: context ? [{
        name: 'Context',
        value: context,
      }] : undefined,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'YouTube Fantasy Basketball Automation',
      },
    }

    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('[Discord] Failed to send error notification:', error)
  }
}

/**
 * Create a formatted Discord embed for player notifications
 */
function createPlayerEmbed(data: NotificationData): DiscordEmbed {
  const { videoId, videoTitle, players, summary, confidence } = data

  // Color based on urgency/confidence
  const color = confidence === 'HIGH' ? 0x00FF00 : confidence === 'MEDIUM' ? 0xFFFF00 : 0xFF9900

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  // Create fields for each player
  const playerFields: DiscordEmbedField[] = players.map((player) => {
    let value = `**Urgency:** ${player.urgency}\n`

    if (player.team) {
      value += `**Team:** ${player.team}\n`
    }

    if (player.position) {
      value += `**Position:** ${player.position}\n`
    }

    if (player.roster_percentage !== undefined) {
      value += `**Rostered:** ${player.roster_percentage}%\n`
    }

    value += `**Reasoning:** ${player.reasoning}`

    if (player.context) {
      value += `\n**Context:** ${player.context}`
    }

    return {
      name: `🏀 ${player.name}`,
      value,
      inline: false,
    }
  })

  const embed: DiscordEmbed = {
    title: videoTitle,
    url: videoUrl,
    description: summary,
    color,
    fields: [
      {
        name: '📊 Analysis Confidence',
        value: confidence,
        inline: true,
      },
      {
        name: '👥 Players Found',
        value: players.length.toString(),
        inline: true,
      },
      ...playerFields,
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'YouTube Fantasy Basketball Automation',
    },
  }

  return embed
}

/**
 * Test the Discord webhook integration
 */
export async function testDiscordWebhook(): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    console.error('[Discord] DISCORD_WEBHOOK_URL not configured')
    return false
  }

  try {
    const testEmbed: DiscordEmbed = {
      title: '✅ Discord Webhook Test',
      description: 'Your Discord integration is working correctly!',
      color: 0x00FF00, // Green
      timestamp: new Date().toISOString(),
      footer: {
        text: 'YouTube Fantasy Basketball Automation',
      },
    }

    const payload: DiscordWebhookPayload = {
      content: '🧪 Test notification',
      embeds: [testEmbed],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Discord] Test failed: ${response.status} - ${errorText}`)
      return false
    }

    console.log('[Discord] Test notification sent successfully')
    return true
  } catch (error) {
    console.error('[Discord] Test failed:', error)
    return false
  }
}
