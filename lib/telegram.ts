const TELEGRAM_API_BASE = "https://api.telegram.org/bot"

function getApiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }
  return `${TELEGRAM_API_BASE}${token}/${method}`
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      type: "private" | "group" | "supergroup" | "channel"
    }
    date: number
    text?: string
  }
}

interface TelegramKeyboardButton {
  text: string
}

interface TelegramReplyKeyboardMarkup {
  keyboard: TelegramKeyboardButton[][]
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
  selective?: boolean
}

interface TelegramReplyKeyboardRemove {
  remove_keyboard: true
  selective?: boolean
}

interface SendMessageOptions {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML"
  replyMarkup?: TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: SendMessageOptions = {}
): Promise<boolean> {
  const { parseMode, replyMarkup } = options

  try {
    const basePayload = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }

    const response = await fetch(getApiUrl("sendMessage"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...basePayload,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      }),
    })

    const result = await response.json()

    if (result.ok) {
      return true
    }

    // Retry once without parse mode in case formatting causes Telegram rejection.
    if (parseMode) {
      const retryResponse = await fetch(getApiUrl("sendMessage"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(basePayload),
      })

      const retryResult = await retryResponse.json()
      return Boolean(retryResult.ok)
    }

    return false
  } catch (error) {
    console.error("Failed to send Telegram message:", error)
    return false
  }
}

export async function setWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const response = await fetch(getApiUrl("setWebhook"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
      }),
    })

    return await response.json()
  } catch (error) {
    console.error("Failed to set webhook:", error)
    return { ok: false, description: String(error) }
  }
}

export async function getWebhookInfo(): Promise<{
  ok: boolean
  result?: {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
  }
}> {
  try {
    const response = await fetch(getApiUrl("getWebhookInfo"), {
      method: "GET",
    })
    return await response.json()
  } catch (error) {
    console.error("Failed to get webhook info:", error)
    return { ok: false }
  }
}

export async function deleteWebhook(): Promise<{ ok: boolean }> {
  try {
    const response = await fetch(getApiUrl("deleteWebhook"), {
      method: "POST",
    })
    return await response.json()
  } catch (error) {
    console.error("Failed to delete webhook:", error)
    return { ok: false }
  }
}

export async function getMe(): Promise<{
  ok: boolean
  result?: {
    id: number
    is_bot: boolean
    first_name: string
    username: string
  }
}> {
  try {
    const response = await fetch(getApiUrl("getMe"), {
      method: "GET",
    })
    return await response.json()
  } catch (error) {
    console.error("Failed to get bot info:", error)
    return { ok: false }
  }
}

// Alias for getMe
export const getBotInfo = getMe

// Escape special characters for MarkdownV2
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")
}
