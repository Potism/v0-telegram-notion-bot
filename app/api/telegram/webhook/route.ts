import { NextResponse } from "next/server"
import { sendMessage } from "@/lib/telegram"
import { processUserMessage } from "@/lib/ai-agent"
import {
  getAllTasks,
  formatTasksForTelegram,
  getBlockedTasks,
  getInProgressTasks,
  getOverdueTasks,
  getPipelineQueueTasks,
  getReviewTasks,
  getTodayTasks,
  getUpcomingTasks,
} from "@/lib/notion-tasks"

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
}

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "📅 What tasks do I have today?" }],
    [{ text: "📆 Show upcoming tasks" }, { text: "⚠️ What's overdue?" }],
    [{ text: "🔄 In production" }, { text: "🧭 What should I do next?" }],
    [{ text: "📥 Team queue" }, { text: "👀 Needs review" }],
    [{ text: "🚫 Blocked" }],
    [{ text: "❓ Help" }, { text: "🙈 Hide keyboard" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
} as const

function normalizeQuickCommand(message: string): string {
  return message
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLowerCase()
}

function getErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
    const maybeStatus = "status" in error ? String((error as { status?: unknown }).status ?? "") : ""
    const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
    const parts = [maybeCode, maybeStatus, maybeMessage].filter(Boolean)
    if (parts.length > 0) {
      return parts.join(" | ")
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown error"
}

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json()

    // Only process text messages
    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = update.message.chat.id
    const userMessage = update.message.text
    const userName = update.message.from.first_name

    try {
      // Handle /start and /menu commands
      if (userMessage === "/start" || userMessage === "/menu") {
        await sendMessage(
          chatId,
          userMessage === "/start"
            ? `Hello ${userName}! 👋\n\nAnvance Production — your Notion board in Telegram. Tap a button below or ask anything (today, queue, review, blocked, Photo/Video tasks…).`
            : `📌 Menu opened — Anvance Production. Tap a quick command or ask in your own words.`,
          {
            replyMarkup: MAIN_MENU_KEYBOARD,
          }
        )
        return NextResponse.json({ ok: true })
      }

      // Hide custom keyboard
      if (userMessage === "🙈 Hide keyboard") {
        await sendMessage(chatId, "Keyboard hidden. Send /menu anytime to show quick commands again.", {
          replyMarkup: {
            remove_keyboard: true,
          },
        })
        return NextResponse.json({ ok: true })
      }

      // Handle /help command
      if (userMessage === "/help" || userMessage === "❓ Help") {
        await sendMessage(
          chatId,
          `📋 **Anvance Production — Bot**\n\n**Buttons:** Today, Upcoming, Overdue, In production, What next, Team queue, Needs review, Blocked.\n\n**Commands:** /menu /debug\n\n**Ask in chat:** e.g. "Show Client review", "Photo tasks this week", "What's blocked?"\n\nNotion is the source of truth; this bot is for fast visibility.`
        )
        return NextResponse.json({ ok: true })
      }

      if (userMessage === "/debug") {
        try {
          const tasks = await getAllTasks()
          await sendMessage(
            chatId,
            `✅ Debug OK\n\nNotion connection works.\nTasks fetched: ${tasks.length}\nDatabase ID: ${process.env.NOTION_DATABASE_ID || "using fallback in code"}`
          )
        } catch (debugError) {
          await sendMessage(
            chatId,
            `❌ Debug failed\n\n${getErrorText(debugError)}\n\nCheck DB share + env vars on Vercel.`
          )
        }
        return NextResponse.json({ ok: true })
      }

      const normalizedMessage = normalizeQuickCommand(userMessage)

      // Handle quick menu commands directly (without AI dependency).
      if (normalizedMessage === "what tasks do i have today?") {
        const tasks = await getTodayTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "📅 Tasks Due Today"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "show upcoming tasks") {
        const tasks = await getUpcomingTasks(7)
        await sendMessage(chatId, formatTasksForTelegram(tasks, "📆 Upcoming (next 7 days)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "what's overdue?" || normalizedMessage === "whats overdue?") {
        const tasks = await getOverdueTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "⚠️ Overdue Tasks"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "show tasks in progress" || normalizedMessage === "in production") {
        const tasks = await getInProgressTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "🔄 In production"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "team queue") {
        const tasks = await getPipelineQueueTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "📥 Team queue (Intake / Briefing / Scheduled)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "needs review") {
        const tasks = await getReviewTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "👀 Needs review"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "blocked") {
        const tasks = await getBlockedTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "🚫 Blocked / on hold"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "what should i do next?") {
        const overdueTasks = await getOverdueTasks()
        if (overdueTasks.length > 0) {
          await sendMessage(
            chatId,
            `Prioritize overdue items first.\n\n${formatTasksForTelegram(overdueTasks, "⚠️ Overdue Tasks")}`
          )
          return NextResponse.json({ ok: true })
        }

        const todayTasks = await getTodayTasks()
        if (todayTasks.length > 0) {
          await sendMessage(chatId, formatTasksForTelegram(todayTasks, "📅 Start With Today's Tasks"))
          return NextResponse.json({ ok: true })
        }

        const upcomingTasks = await getUpcomingTasks(7)
        await sendMessage(chatId, formatTasksForTelegram(upcomingTasks, "📆 Next Up (7 Days)"))
        return NextResponse.json({ ok: true })
      }

      // Process the message with AI
      const response = await processUserMessage(userMessage)
      await sendMessage(chatId, response)

      return NextResponse.json({ ok: true })
    } catch (error) {
      console.error("[v0] Message processing error:", error)
      await sendMessage(
        chatId,
        `⚠️ I couldn't fetch tasks right now.\n\n${getErrorText(error)}\n\nSend /debug for connection details.`
      )
      return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error("[v0] Telegram webhook error:", error)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: "Telegram webhook is active" })
}
