/**
 * Notion → Telegram: notify teammates when they are assigned on the Production board.
 * @see https://developers.notion.com/reference/webhooks-events-delivery
 */

import { sendMessage } from "@/lib/telegram"

function envProp(val: string | undefined, fallback: string): string {
  return (val ?? fallback).trim()
}

const DATABASE_ID = envProp(process.env.NOTION_DATABASE_ID, "")
const TASK_NAME_PROPERTY = envProp(process.env.NOTION_TASK_NAME_PROPERTY, "Name")
const STATUS_PROPERTY = envProp(process.env.NOTION_STATUS_PROPERTY, "Status")
const DUE_DATE_PROPERTY = envProp(process.env.NOTION_DUE_DATE_PROPERTY, "Due date")
const CLIENT_PROPERTY = envProp(process.env.NOTION_CLIENT_PROPERTY, "Client")
const ASSIGNEE_PROPERTY = envProp(process.env.NOTION_ASSIGNEE_PROPERTY, "Assignee")

/** `false` / `0` / `no` disables. Otherwise on if user map or group id is configured. */
function isAssignmentNotifyEnabled(): boolean {
  const v = process.env.NOTIF_ASSIGNMENT_ENABLED?.toLowerCase().trim()
  if (v === "false" || v === "0" || v === "no") return false
  if (v === "true" || v === "1" || v === "yes") return true
  return parseUserMap().size > 0 || Boolean(process.env.TELEGRAM_ASSIGNMENT_GROUP_ID?.trim())
}

type NotifyMode = "dm" | "group" | "both"

function getNotifyMode(): NotifyMode {
  const m = (process.env.TELEGRAM_ASSIGNMENT_NOTIFY_MODE || "dm").toLowerCase().trim()
  if (m === "group" || m === "both") return m
  return "dm"
}

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase()
}

function parseUserMap(): Map<string, string> {
  const raw = process.env.TELEGRAM_NOTION_USER_MAP?.trim()
  const map = new Map<string, string>()
  if (!raw) return map
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return map
    for (const row of arr) {
      if (!row || typeof row !== "object") continue
      const o = row as { notionUserId?: string; telegramChatId?: string | number }
      const nid = o.notionUserId?.trim()
      const tid = o.telegramChatId != null ? String(o.telegramChatId).trim() : ""
      if (nid && tid) {
        map.set(normalizeNotionId(nid), tid)
      }
    }
  } catch {
    console.warn("[assignment] TELEGRAM_NOTION_USER_MAP is not valid JSON")
  }
  return map
}

let schemaCache: { assigneePropId: string | null; at: number } | null = null
const SCHEMA_TTL_MS = 10 * 60 * 1000

async function notionApi<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.NOTION_API_KEY
  if (!key) throw new Error("NOTION_API_KEY is not set")
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": "2022-06-28",
      ...(init?.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : res.statusText
    throw new Error(msg)
  }
  return data as T
}

async function getAssigneePropertyId(): Promise<string | null> {
  const now = Date.now()
  if (schemaCache && now - schemaCache.at < SCHEMA_TTL_MS) {
    return schemaCache.assigneePropId
  }
  if (!DATABASE_ID) {
    schemaCache = { assigneePropId: null, at: now }
    return null
  }
  const db = await notionApi<{ properties?: Record<string, { id?: string }> }>(`/databases/${DATABASE_ID}`)
  const prop = db.properties?.[ASSIGNEE_PROPERTY]
  const id = prop?.id?.trim() ?? null
  schemaCache = { assigneePropId: id, at: now }
  return id
}

function decodeUpdatedPropId(encoded: string): string {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return encoded
  }
}

async function assigneeColumnMightHaveChanged(body: Record<string, unknown>): Promise<boolean> {
  const data = body.data as { updated_properties?: string[] } | undefined
  const updated = data?.updated_properties
  if (!updated?.length) return true
  const assigneeId = await getAssigneePropertyId()
  if (!assigneeId) return true
  return updated.some((enc) => decodeUpdatedPropId(enc) === assigneeId)
}

interface NotionPage {
  id: string
  url?: string
  properties?: Record<string, unknown>
}

function plainTitle(properties: Record<string, unknown> | undefined): string {
  if (!properties) return "Untitled"
  const p = properties[TASK_NAME_PROPERTY] as { type?: string; title?: Array<{ plain_text?: string }> } | undefined
  if (p?.type === "title" && p.title?.length) {
    return p.title.map((t) => t.plain_text ?? "").join("").trim() || "Untitled"
  }
  return "Untitled"
}

function plainStatus(properties: Record<string, unknown> | undefined): string {
  if (!properties) return ""
  const p = properties[STATUS_PROPERTY] as
    | { type?: string; status?: { name?: string }; select?: { name?: string } }
    | undefined
  if (p?.type === "status" && p.status?.name) return p.status.name
  if (p?.type === "select" && p.select?.name) return p.select.name
  return ""
}

function plainDue(properties: Record<string, unknown> | undefined): string {
  if (!properties) return ""
  const p = properties[DUE_DATE_PROPERTY] as { type?: string; date?: { start?: string } | null } | undefined
  if (p?.type === "date" && p.date?.start) return p.date.start
  return ""
}

function plainClient(properties: Record<string, unknown> | undefined): string {
  if (!properties) return ""
  const p = properties[CLIENT_PROPERTY] as { type?: string; select?: { name?: string } } | undefined
  if (p?.type === "select" && p.select?.name) return p.select.name
  return ""
}

function extractAssigneeNotionIds(properties: Record<string, unknown> | undefined): string[] {
  if (!properties) return []
  const p = properties[ASSIGNEE_PROPERTY] as {
    type?: string
    people?: Array<{ id?: string }>
  } | undefined
  if (p?.type !== "people" || !p.people?.length) return []
  return p.people.map((x) => x.id).filter((id): id is string => Boolean(id))
}

function notionPublicUrl(pageId: string): string {
  const compact = pageId.replace(/-/g, "")
  return `https://www.notion.so/${compact}`
}

function buildDmLines(args: { title: string; client: string; status: string; due: string; pageUrl: string }): string {
  const lines = [
    "Anvance Production — you've been assigned",
    "",
    `Task: ${args.title}`,
  ]
  if (args.client) lines.push(`Client: ${args.client}`)
  if (args.status) lines.push(`Status: ${args.status}`)
  if (args.due) lines.push(`Due: ${args.due}`)
  lines.push("", `Open in Notion: ${args.pageUrl}`)
  lines.push("", "Tip: use /menu in this bot for quick task views.")
  return lines.join("\n")
}

function buildGroupLine(args: { title: string; who: string; status: string; due: string; pageUrl: string }) {
  return (
    `Anvance — assigned (${args.who})\n` +
    `${args.title}${args.status ? ` — ${args.status}` : ""}${args.due ? ` — due ${args.due}` : ""}\n` +
    args.pageUrl
  )
}

/**
 * Handle official Notion webhook envelope (top-level `type`, `entity`, `data`).
 * @see https://developers.notion.com/reference/webhooks-events-delivery
 */
export async function handleNotionWebhookForAssignments(body: Record<string, unknown>): Promise<void> {
  if (!isAssignmentNotifyEnabled()) return

  const eventType = body.type as string | undefined
  if (!eventType) return

  const legacyPageUpdated = eventType === "page.updated"
  const supported =
    eventType === "page.created" ||
    eventType === "page.properties_updated" ||
    legacyPageUpdated

  if (!supported) return

  if (eventType === "page.properties_updated") {
    const might = await assigneeColumnMightHaveChanged(body)
    if (!might) return
  }

  const entity = body.entity as { id?: string; type?: string } | undefined
  let pageId: string | null = null
  if (entity?.type === "page" && entity.id) {
    pageId = entity.id
  } else {
    const d = body.data as { id?: string; type?: string } | undefined
    if (d?.type === "page" && d.id) pageId = d.id
  }

  if (!pageId || !DATABASE_ID) return

  const page = await notionApi<NotionPage>(`/pages/${pageId}`)
  const parent = (page as { parent?: { type?: string; database_id?: string } }).parent
  if (parent?.type === "database_id" && parent.database_id) {
    if (normalizeNotionId(parent.database_id) !== normalizeNotionId(DATABASE_ID)) {
      return
    }
  }

  const props = page.properties as Record<string, unknown> | undefined
  const assigneeIds = extractAssigneeNotionIds(props)
  if (!assigneeIds.length) return

  const title = plainTitle(props)
  const status = plainStatus(props)
  const due = plainDue(props)
  const client = plainClient(props)
  const pageUrl = page.url || notionPublicUrl(page.id)

  const userMap = parseUserMap()
  const mode = getNotifyMode()
  const groupId = process.env.TELEGRAM_ASSIGNMENT_GROUP_ID?.trim()

  const mappedChatIds: string[] = []
  for (const notionUserId of assigneeIds) {
    const chatId = userMap.get(normalizeNotionId(notionUserId))
    if (chatId) mappedChatIds.push(chatId)
  }

  const dmText = buildDmLines({ title, client, status, due, pageUrl })

  if (mode === "dm" || mode === "both") {
    for (const chatId of mappedChatIds) {
      await sendMessage(chatId, dmText, {})
    }
  }

  if ((mode === "group" || mode === "both") && groupId) {
    const who =
      mappedChatIds.length > 0
        ? `${mappedChatIds.length} teammate(s) (DM sent where mapped)`
        : `${assigneeIds.length} assignee(s) on Notion (add TELEGRAM_NOTION_USER_MAP for DMs)`
    const groupText = buildGroupLine({ title, who, status, due, pageUrl })
    await sendMessage(groupId, groupText, {})
  }
}
