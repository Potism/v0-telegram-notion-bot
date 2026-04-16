/**
 * Onboarding copy and identity formatting for Anvance Team Bot.
 * Telegram IDs are shown so admins can add rows to TELEGRAM_NOTION_USER_MAP (or a future Notion directory).
 */

export type TelegramChatType = "private" | "group" | "supergroup" | "channel" | string

export interface TelegramMemberSnapshot {
  telegramUserId: number
  chatId: number
  chatType: TelegramChatType
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
}

function escapeAngle(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›")
}

function displayName(s: TelegramMemberSnapshot): string {
  const parts = [s.firstName, s.lastName].filter(Boolean)
  return escapeAngle(parts.join(" ").trim() || "there")
}

/** Short welcome (private chat, first message). */
export function buildWelcomeHeadline(snapshot: TelegramMemberSnapshot): string {
  const who = displayName(snapshot)
  return (
    `Welcome to Anvance Team Bot, ${who}.\n\n` +
    `This is your production copilot: Notion stays the source of truth; here you get fast reads, ` +
    `assignment heads-ups, and quick filters.\n\n` +
    `Next message has your Telegram details—your lead uses them once to link you to Notion ` +
    `(/mytasks + assignment DMs).`
  )
}

/**
 * Identity + copy-paste helper for admins (second /start message or /id).
 * Plain text only (safe for any name characters).
 */
export function buildIdentityCard(snapshot: TelegramMemberSnapshot, notionLinked: boolean): string {
  const handle = snapshot.username ? `@${escapeAngle(snapshot.username)}` : "(no username — that's fine)"
  const lang = snapshot.languageCode ? snapshot.languageCode : "—"
  const linkHint =
    "In Notion: open any page with you on People, or workspace Members, and copy your Notion user id (UUID)."

  const mapLine =
    `{ "notionUserId": "<PASTE_NOTION_USER_UUID_HERE>", "telegramChatId": "${snapshot.telegramUserId}" }`

  const status = notionLinked
    ? "Status: linked — /mytasks and assignment DMs should work for you."
    : "Status: not linked yet — send the JSON line below to whoever manages the bot env (or your Notion directory)."

  return (
    `📇 Your Telegram profile (for Notion linking)\n\n` +
    `Telegram user id (this is usually your telegramChatId in private chat):\n` +
    `${snapshot.telegramUserId}\n\n` +
    `Chat id (same as user id in private DMs):\n` +
    `${snapshot.chatId}\n\n` +
    `Name on Telegram:\n` +
    `${displayName(snapshot)}\n\n` +
    `Username:\n` +
    `${handle}\n\n` +
    `Language code:\n` +
    `${lang}\n\n` +
    `${status}\n\n` +
    `${linkHint}\n\n` +
    `One row for TELEGRAM_NOTION_USER_MAP (replace the placeholder):\n` +
    `${mapLine}\n\n` +
    `After you're linked, use 📋 My tasks or /mytasks. Tap /menu for shortcuts.`
  )
}

/** When someone hits /start in a group: point them to DM for IDs and personal features. */
export function buildGroupStartHint(botUsername?: string): string {
  const dm =
    botUsername && botUsername.length > 0
      ? `Open a private chat with @${botUsername.replace(/^@/, "")} and send /start there.`
      : "Open a private chat with this bot (from its profile) and send /start there."
  return (
    `Anvance Team Bot works best in a private chat so we can show your Telegram id safely ` +
    `and unlock /mytasks plus assignment DMs.\n\n` +
    `${dm}\n\n` +
    `In this group you can still use quick buttons if the keyboard is open, but identity and ` +
    `linking steps need a DM.`
  )
}
