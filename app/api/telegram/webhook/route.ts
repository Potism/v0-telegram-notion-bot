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
  getMyAssignedTasks,
} from "@/lib/notion-tasks"
import { getNotionUserIdForTelegramUser } from "@/lib/notion-assignment-notify"
import {
  buildGroupStartHint,
  buildIdentityCard,
  buildWelcomeHeadline,
  type TelegramMemberSnapshot,
} from "@/lib/telegram-onboarding"

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
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
    [{ text: "📋 My tasks" }],
    [{ text: "📇 My Telegram ID" }],
    [{ text: "🚫 Blocked" }],
    [{ text: "❓ Help" }, { text: "🙈 Hide keyboard" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
} as const

function commandToken(text: string): string {
  return (text.trim().split(/\s+/)[0] ?? "").split("@")[0].toLowerCase()
}

function normalizeQuickCommand(message: string): string {
  return message
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLowerCase()
}

/** Handles `/mytasks`, `/mytasks@BotName`, `/mytask`, etc. */
function isMyTasksCommand(text: string): boolean {
  const cmd = commandToken(text)
  return cmd === "/mytasks" || cmd === "/mytask"
}

function isStartCommand(text: string): boolean {
  return commandToken(text) === "/start"
}

function isIdCommand(text: string): boolean {
  const cmd = commandToken(text)
  return cmd === "/id" || cmd === "/whoami" || cmd === "/profile"
}

function snapshotFromUpdate(update: TelegramUpdate): TelegramMemberSnapshot | null {
  const m = update.message
  if (!m?.from) return null
  return {
    telegramUserId: m.from.id,
    chatId: m.chat.id,
    chatType: m.chat.type,
    firstName: m.from.first_name,
    lastName: m.from.last_name,
    username: m.from.username,
    languageCode: m.from.language_code,
  }
}

function menuKeyboardForChat(chatType: string): typeof MAIN_MENU_KEYBOARD | undefined {
  return chatType === "private" ? MAIN_MENU_KEYBOARD : undefined
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

function unlinkHint(): string {
  return (
    "You are not linked to Notion yet.\n\n" +
    "Tap 📇 My Telegram ID (or send /id), copy the line for TELEGRAM_NOTION_USER_MAP, " +
    "and ask your admin to add your Notion user UUID. Then /mytasks will work."
  )
}

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json()

    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = update.message.chat.id
    const userMessage = update.message.text
    const chatType = update.message.chat.type
    const from = update.message.from
    const userName = from.first_name
    const notionLinked = Boolean(getNotionUserIdForTelegramUser(from.id))
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Anvance teammate"

    try {
      if (isStartCommand(userMessage)) {
        const snap = snapshotFromUpdate(update)
        if (!snap) {
          await sendMessage(chatId, "Could not read your Telegram profile. Try again.")
          return NextResponse.json({ ok: true })
        }

        if (chatType !== "private") {
          const botUser = process.env.TELEGRAM_BOT_USERNAME?.trim()
          await sendMessage(chatId, buildGroupStartHint(botUser))
          return NextResponse.json({ ok: true })
        }

        await sendMessage(chatId, buildWelcomeHeadline(snap))
        await sendMessage(chatId, buildIdentityCard(snap, notionLinked), {
          replyMarkup: MAIN_MENU_KEYBOARD,
        })
        return NextResponse.json({ ok: true })
      }

      if (userMessage === "/menu") {
        const keyboard = menuKeyboardForChat(chatType)
        if (chatType === "private") {
          await sendMessage(
            chatId,
            "Anvance Production — quick board shortcuts below. Ask anything in chat for filters, statuses, or service lines.",
            { replyMarkup: keyboard }
          )
        } else {
          await sendMessage(
            chatId,
            "Anvance Production — board shortcuts.\n\n" +
              "For your Telegram id and /mytasks, open a private chat with this bot.\n\n" +
              "Commands: /mytasks /debug /id /help\n" +
              "In a group, quick buttons (if shown) still query the shared Notion database."
          )
        }
        return NextResponse.json({ ok: true })
      }

      if (userMessage === "🙈 Hide keyboard") {
        await sendMessage(chatId, "Keyboard hidden. Send /menu anytime to show quick commands again.", {
          replyMarkup: {
            remove_keyboard: true,
          },
        })
        return NextResponse.json({ ok: true })
      }

      if (userMessage === "/help" || userMessage === "❓ Help") {
        await sendMessage(
          chatId,
          "Anvance Team Bot — Help\n\n" +
            "Buttons (private chat): Today, Upcoming, Overdue, In production, What next, Team queue, Needs review, My tasks, My Telegram ID, Blocked.\n\n" +
            "Commands: /start (welcome + your ids) · /menu · /id · /mytasks · /debug · /help\n\n" +
            "Ask in chat: e.g. Client review this week, Photo tasks, what's blocked.\n\n" +
            "/mytasks needs a Notion user link (TELEGRAM_NOTION_USER_MAP). /id shows what to send your admin.\n\n" +
            "Notion is the source of truth."
        )
        return NextResponse.json({ ok: true })
      }

      if (isIdCommand(userMessage)) {
        const snap = snapshotFromUpdate(update)
        if (!snap) {
          await sendMessage(chatId, "Could not read your Telegram profile. Try again.")
          return NextResponse.json({ ok: true })
        }
        if (chatType !== "private") {
          await sendMessage(
            chatId,
            "For your Telegram id, open a private chat with this bot and send /id there."
          )
          return NextResponse.json({ ok: true })
        }
        await sendMessage(chatId, buildIdentityCard(snap, notionLinked), {
          replyMarkup: menuKeyboardForChat(chatType),
        })
        return NextResponse.json({ ok: true })
      }

      if (userMessage === "/debug") {
        try {
          const tasks = await getAllTasks()
          await sendMessage(
            chatId,
            `Debug OK\n\nNotion connection works.\nTasks fetched: ${tasks.length}\nDatabase ID: ${process.env.NOTION_DATABASE_ID || "using fallback in code"}\n\nNotion link for you: ${notionLinked ? "yes" : "no"}`
          )
        } catch (debugError) {
          await sendMessage(
            chatId,
            `Debug failed\n\n${getErrorText(debugError)}\n\nCheck DB share + env vars on Vercel.`
          )
        }
        return NextResponse.json({ ok: true })
      }

      if (isMyTasksCommand(userMessage)) {
        const notionUserId = getNotionUserIdForTelegramUser(from.id)
        if (!notionUserId) {
          await sendMessage(chatId, unlinkHint())
          return NextResponse.json({ ok: true })
        }
        const tasks = await getMyAssignedTasks(notionUserId)
        await sendMessage(chatId, formatTasksForTelegram(tasks, "My assigned tasks (active)"))
        return NextResponse.json({ ok: true })
      }

      const normalizedMessage = normalizeQuickCommand(userMessage)

      if (normalizedMessage === "what tasks do i have today?") {
        const tasks = await getTodayTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Tasks Due Today"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "show upcoming tasks") {
        const tasks = await getUpcomingTasks(7)
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Upcoming (next 7 days)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "what's overdue?" || normalizedMessage === "whats overdue?") {
        const tasks = await getOverdueTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Overdue Tasks"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "show tasks in progress" || normalizedMessage === "in production") {
        const tasks = await getInProgressTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "In production"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "team queue") {
        const tasks = await getPipelineQueueTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Team queue (Intake / Briefing / Scheduled)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "needs review") {
        const tasks = await getReviewTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Needs review"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "blocked") {
        const tasks = await getBlockedTasks()
        await sendMessage(chatId, formatTasksForTelegram(tasks, "Blocked / on hold"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "my tasks") {
        const notionUserId = getNotionUserIdForTelegramUser(from.id)
        if (!notionUserId) {
          await sendMessage(chatId, unlinkHint())
          return NextResponse.json({ ok: true })
        }
        const tasks = await getMyAssignedTasks(notionUserId)
        await sendMessage(chatId, formatTasksForTelegram(tasks, "My assigned tasks (active)"))
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "my telegram id") {
        const snap = snapshotFromUpdate(update)
        if (!snap) {
          await sendMessage(chatId, "Could not read your Telegram profile. Try again.")
          return NextResponse.json({ ok: true })
        }
        if (chatType !== "private") {
          await sendMessage(
            chatId,
            "Open a private chat with this bot and tap My Telegram ID there (or send /id)."
          )
          return NextResponse.json({ ok: true })
        }
        await sendMessage(chatId, buildIdentityCard(snap, notionLinked), {
          replyMarkup: menuKeyboardForChat(chatType),
        })
        return NextResponse.json({ ok: true })
      }

      if (normalizedMessage === "what should i do next?") {
        const overdueTasks = await getOverdueTasks()
        if (overdueTasks.length > 0) {
          await sendMessage(
            chatId,
            `Prioritize overdue first.\n\n${formatTasksForTelegram(overdueTasks, "Overdue Tasks")}`
          )
          return NextResponse.json({ ok: true })
        }

        const todayTasks = await getTodayTasks()
        if (todayTasks.length > 0) {
          await sendMessage(chatId, formatTasksForTelegram(todayTasks, "Start with today"))
          return NextResponse.json({ ok: true })
        }

        const upcomingTasks = await getUpcomingTasks(7)
        await sendMessage(chatId, formatTasksForTelegram(upcomingTasks, "Next up (7 days)"))
        return NextResponse.json({ ok: true })
      }

      const response = await processUserMessage(userMessage, {
        telegramUserId: from.id,
        displayName,
        notionLinked,
        chatType,
      })
      await sendMessage(chatId, response)

      return NextResponse.json({ ok: true })
    } catch (error) {
      console.error("[v0] Message processing error:", error)
      await sendMessage(
        chatId,
        `Could not fetch tasks right now.\n\n${getErrorText(error)}\n\nSend /debug for connection details.`
      )
      return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error("[v0] Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Telegram webhook is active" })
}
