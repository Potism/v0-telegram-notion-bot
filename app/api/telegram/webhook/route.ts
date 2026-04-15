import { NextResponse } from "next/server"
import { sendMessage } from "@/lib/telegram"
import { processUserMessage } from "@/lib/ai-agent"
import {
  formatTasksForTelegram,
  getInProgressTasks,
  getOverdueTasks,
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
    [{ text: "🔄 Show tasks in progress" }, { text: "🧭 What should I do next?" }],
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
            ? `Hello ${userName}! 👋\n\nI'm your Notion Task Assistant. You can tap a button below for quick commands, or type your own question anytime.`
            : `📌 Menu opened. Tap a quick command below, or type your own question anytime.`,
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
          `📋 **Task Assistant Commands**\n\nYou can ask me in natural language:\n\n**Today's Tasks:**\n• "What do I need to do today?"\n• "Today's tasks"\n\n**Upcoming:**\n• "What's coming up this week?"\n• "Show upcoming tasks"\n\n**By Status:**\n• "Show tasks in progress"\n• "What's not started?"\n• "What have I completed?"\n\n**Overdue:**\n• "What's overdue?"\n• "Am I behind on anything?"\n\n**Search:**\n• "Find tasks about [keyword]"\n\nUse /menu anytime to open quick command buttons.`
        )
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
        await sendMessage(chatId, formatTasksForTelegram(tasks, "📆 Upcoming Tasks (Next 7 Days)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "what's overdue?" || normalizedMessage === "whats overdue?") {
        const tasks = await getOverdueTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "⚠️ Overdue Tasks"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "show tasks in progress") {
        const tasks = await getInProgressTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "🔄 Tasks In Progress"))
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
        "⚠️ I couldn't fetch tasks right now. Please check your Notion database connection and try again."
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
