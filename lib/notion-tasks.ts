import { Client } from "@notionhq/client"
import {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints"

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

function envProp(val: string | undefined, fallback: string): string {
  return (val ?? fallback).trim()
}

/** Optional column: unset env = do not query (avoids invalid OR branches if column missing). */
function envPropOptional(val: string | undefined): string {
  if (val === undefined || val === null) return ""
  const t = String(val).trim()
  if (t === "" || t === "-" || t.toLowerCase() === "none") return ""
  return t
}

// Database + properties (override via env to match your Notion DB)
const DATABASE_ID = envProp(process.env.NOTION_DATABASE_ID, "3428ab25d01e806eb5f0eaf1a1871aff")
const TASK_NAME_PROPERTY = envProp(process.env.NOTION_TASK_NAME_PROPERTY, "Name")
/** Must match Notion column name exactly (export shows `Due date`). */
const DUE_DATE_PROPERTY = envProp(process.env.NOTION_DUE_DATE_PROPERTY, "Due date")
/** Matches Anvance CSV; set env to `-` or `none` to disable. */
const SHOOT_LIVE_DATE_PROPERTY =
  process.env.NOTION_SHOOT_LIVE_DATE_PROPERTY === undefined
    ? "Shoot / live date"
    : envPropOptional(process.env.NOTION_SHOOT_LIVE_DATE_PROPERTY)
const STATUS_PROPERTY = envProp(process.env.NOTION_STATUS_PROPERTY, "Status")
const ASSIGNEE_PROPERTY = envProp(process.env.NOTION_ASSIGNEE_PROPERTY, "Assignee")
const COLLABORATORS_PROPERTY = envProp(process.env.NOTION_COLLABORATORS_PROPERTY, "Collaborators")
const REVIEWER_PROPERTY = envProp(process.env.NOTION_REVIEWER_PROPERTY, "Reviewer")
const CLIENT_PROPERTY = envProp(process.env.NOTION_CLIENT_PROPERTY, "Client")
const SERVICE_LINE_PROPERTY = envProp(process.env.NOTION_SERVICE_LINE_PROPERTY, "Service line")
const DELIVERABLE_PROPERTY = envProp(process.env.NOTION_DELIVERABLE_PROPERTY, "Deliverable")
const PRIORITY_PROPERTY = envProp(process.env.NOTION_PRIORITY_PROPERTY, "Priority")
const CHANNELS_PROPERTY = envProp(process.env.NOTION_CHANNELS_PROPERTY, "Channels")
const BRIEF_LINK_PROPERTY = envProp(process.env.NOTION_BRIEF_LINK_PROPERTY, "Brief link")
const ASSETS_LINK_PROPERTY = envProp(process.env.NOTION_ASSETS_LINK_PROPERTY, "Assets link")
const INTERNAL_NOTES_PROPERTY = envProp(process.env.NOTION_INTERNAL_NOTES_PROPERTY, "Internal notes")
const BLOCKED_BY_PROPERTY = envProp(process.env.NOTION_BLOCKED_BY_PROPERTY, "Blocked by")
const CLIENT_APPROVAL_PROPERTY = envProp(process.env.NOTION_CLIENT_APPROVAL_PROPERTY, "Client approval")
const CAMPAIGN_PROPERTY = envProp(process.env.NOTION_CAMPAIGN_PROPERTY, "Campaign")

const STATUS_FILTER_TYPE = (process.env.NOTION_STATUS_FILTER_TYPE || "select").toLowerCase()

const STATUS_DONE = process.env.NOTION_STATUS_DONE || "Done"
const STATUS_ON_HOLD = process.env.NOTION_STATUS_ON_HOLD || "On hold"
const STATUS_IN_PROGRESS = process.env.NOTION_STATUS_IN_PROGRESS || "In production"
/** Comma-separated statuses for “team queue” (intake → scheduled). */
const PIPELINE_QUEUE_STATUSES = (
  process.env.NOTION_PIPELINE_QUEUE_STATUSES ||
  "Intake,Briefing,Scheduled"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
/** Comma-separated for “needs review”. */
const REVIEW_STATUSES = (
  process.env.NOTION_REVIEW_STATUSES || "Internal review,Client review"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

interface QueryTasksDatabaseOptions {
  filter?: Record<string, unknown>
  sorts?: Array<Record<string, unknown>>
}

export interface Task {
  id: string
  name: string
  status: string
  dueDate: string | null
  shootOrLiveDate: string | null
  assignee: string | null
  collaborators: string | null
  reviewer: string | null
  client: string | null
  serviceLine: string | null
  deliverable: string | null
  priority: string | null
  channels: string | null
  briefLink: string | null
  assetsLink: string | null
  internalNotes: string | null
  blockedBy: string | null
  clientApproval: string | null
  campaign: string | null
  latestComment: string | null
  commentCount: number
}

function plainFromRichText(prop: { type: "rich_text"; rich_text: Array<{ plain_text?: string }> } | undefined): string | null {
  if (!prop || prop.type !== "rich_text" || !prop.rich_text?.length) return null
  const t = prop.rich_text.map((r) => r.plain_text ?? "").join("").trim()
  return t || null
}

function peopleNames(prop: PageObjectResponse["properties"][string]): string | null {
  if (!prop || prop.type !== "people" || !prop.people.length) return null
  const names = prop.people
    .map((p) => ("name" in p && p.name ? p.name : null))
    .filter(Boolean) as string[]
  return names.length ? names.join(", ") : null
}

function extractTaskFromPage(page: PageObjectResponse): Task {
  const properties = page.properties

  let name = "Untitled"
  const taskNameProp = properties[TASK_NAME_PROPERTY]
  if (taskNameProp?.type === "title" && taskNameProp.title.length > 0) {
    name = taskNameProp.title.map((t: any) => t.plain_text).join("")
  }

  let status = PIPELINE_QUEUE_STATUSES[0] || "Intake"
  const statusProp = properties[STATUS_PROPERTY]
  if (statusProp?.type === "status" && statusProp.status) {
    status = statusProp.status.name
  } else if (statusProp?.type === "select" && statusProp.select) {
    status = statusProp.select.name
  }

  let dueDate: string | null = null
  const dueDateProp = properties[DUE_DATE_PROPERTY]
  if (dueDateProp?.type === "date" && dueDateProp.date) {
    dueDate = dueDateProp.date.start
  }

  let shootOrLiveDate: string | null = null
  if (SHOOT_LIVE_DATE_PROPERTY) {
    const shootProp = properties[SHOOT_LIVE_DATE_PROPERTY]
    if (shootProp?.type === "date" && shootProp.date) {
      shootOrLiveDate = shootProp.date.start
    }
  }

  const assignee = peopleNames(properties[ASSIGNEE_PROPERTY])
  const collaborators = COLLABORATORS_PROPERTY ? peopleNames(properties[COLLABORATORS_PROPERTY]) : null
  const reviewer = REVIEWER_PROPERTY ? peopleNames(properties[REVIEWER_PROPERTY]) : null

  let client: string | null = null
  if (CLIENT_PROPERTY) {
    const c = properties[CLIENT_PROPERTY]
    if (c?.type === "select" && c.select) client = c.select.name
    else if (c?.type === "rich_text") client = plainFromRichText(c)
  }

  let serviceLine: string | null = null
  if (SERVICE_LINE_PROPERTY) {
    const s = properties[SERVICE_LINE_PROPERTY]
    if (s?.type === "select" && s.select) serviceLine = s.select.name
  }

  let deliverable: string | null = null
  if (DELIVERABLE_PROPERTY) {
    const d = properties[DELIVERABLE_PROPERTY]
    if (d?.type === "select" && d.select) deliverable = d.select.name
  }

  let priority: string | null = null
  if (PRIORITY_PROPERTY) {
    const p = properties[PRIORITY_PROPERTY]
    if (p?.type === "select" && p.select) priority = p.select.name
  }

  let channels: string | null = null
  if (CHANNELS_PROPERTY) {
    const ch = properties[CHANNELS_PROPERTY]
    if (ch?.type === "multi_select" && ch.multi_select.length) {
      channels = ch.multi_select.map((m) => m.name).join(", ")
    }
  }

  let briefLink: string | null = null
  if (BRIEF_LINK_PROPERTY) {
    const b = properties[BRIEF_LINK_PROPERTY]
    if (b?.type === "url" && b.url) briefLink = b.url
  }

  let assetsLink: string | null = null
  if (ASSETS_LINK_PROPERTY) {
    const a = properties[ASSETS_LINK_PROPERTY]
    if (a?.type === "url" && a.url) assetsLink = a.url
  }

  let internalNotes: string | null = null
  if (INTERNAL_NOTES_PROPERTY) {
    const n = properties[INTERNAL_NOTES_PROPERTY]
    if (n?.type === "rich_text") internalNotes = plainFromRichText(n)
  }

  let blockedBy: string | null = null
  if (BLOCKED_BY_PROPERTY) {
    const bl = properties[BLOCKED_BY_PROPERTY]
    if (bl?.type === "rich_text") blockedBy = plainFromRichText(bl)
  }

  let clientApproval: string | null = null
  if (CLIENT_APPROVAL_PROPERTY) {
    const ca = properties[CLIENT_APPROVAL_PROPERTY]
    if (ca?.type === "select" && ca.select) clientApproval = ca.select.name
  }

  let campaign: string | null = null
  if (CAMPAIGN_PROPERTY) {
    const camp = properties[CAMPAIGN_PROPERTY]
    if (camp?.type === "rich_text") campaign = plainFromRichText(camp)
    else if (camp?.type === "select" && camp.select) campaign = camp.select.name
    else if (camp?.type === "title" && camp.title.length) {
      campaign = camp.title.map((t: any) => t.plain_text).join("")
    }
  }

  return {
    id: page.id,
    name,
    status,
    dueDate,
    shootOrLiveDate,
    assignee,
    collaborators,
    reviewer,
    client,
    serviceLine,
    deliverable,
    priority,
    channels,
    briefLink,
    assetsLink,
    internalNotes,
    blockedBy,
    clientApproval,
    campaign,
    latestComment: null,
    commentCount: 0,
  }
}

function buildStatusEqualsFilter(value: string) {
  if (STATUS_FILTER_TYPE === "status") {
    return {
      property: STATUS_PROPERTY,
      status: { equals: value },
    }
  }
  return {
    property: STATUS_PROPERTY,
    select: { equals: value },
  }
}

function buildStatusDoesNotEqualFilter(value: string) {
  if (STATUS_FILTER_TYPE === "status") {
    return {
      property: STATUS_PROPERTY,
      status: { does_not_equal: value },
    }
  }
  return {
    property: STATUS_PROPERTY,
    select: { does_not_equal: value },
  }
}

function buildStatusOrEqualsFilter(statuses: string[]) {
  if (statuses.length === 0) {
    return buildStatusEqualsFilter(STATUS_IN_PROGRESS)
  }
  if (statuses.length === 1) {
    return buildStatusEqualsFilter(statuses[0])
  }
  return {
    or: statuses.map((s) => buildStatusEqualsFilter(s)),
  }
}

function compactFilters(filters: Array<Record<string, unknown> | null | undefined>): Record<string, unknown>[] {
  return filters.filter((f): f is Record<string, unknown> => Boolean(f))
}

function safeSorts(...sorts: Array<{ property: string; direction: "ascending" | "descending" } | null | undefined>) {
  return sorts.filter(
    (s): s is { property: string; direction: "ascending" | "descending" } =>
      Boolean(s?.property?.trim())
  )
}

function buildDateEqualsFilter(propertyName: string, dateValue: string): Record<string, unknown> | null {
  const property = propertyName.trim()
  if (!property || !dateValue?.trim()) return null
  return {
    property,
    date: { equals: dateValue.trim() },
  }
}

function buildDateRangeFilter(
  propertyName: string,
  start: string,
  end: string
): Record<string, unknown> | null {
  const property = propertyName.trim()
  if (!property || !start?.trim() || !end?.trim()) return null
  return {
    and: [
      { property, date: { on_or_after: start.trim() } },
      { property, date: { on_or_before: end.trim() } },
    ],
  }
}

function isFilterValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes("validation_error") && error.message.includes("body.filter")
}

async function runTodayQuery(dateFilter: Record<string, unknown>): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [dateFilter, ...buildActiveTaskFilters()],
    },
    sorts: safeSorts(
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: STATUS_PROPERTY, direction: "ascending" }
    ),
  })
  return enrichTasksWithComments(extractTasks(response))
}

function buildOptionalOrFilter(filters: Record<string, unknown>[]): Record<string, unknown> | null {
  if (filters.length === 0) return null
  if (filters.length === 1) return filters[0]
  return { or: filters }
}

/** Active work items: not Done and not On hold (if On hold exists). */
function buildActiveTaskFilters(): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [buildStatusDoesNotEqualFilter(STATUS_DONE)]
  if (STATUS_ON_HOLD) {
    filters.push(buildStatusDoesNotEqualFilter(STATUS_ON_HOLD))
  }
  return filters
}

function isSortPropertyNotFoundError(responseData: unknown): boolean {
  if (!responseData || typeof responseData !== "object") return false
  const data = responseData as { code?: string; message?: string }
  if (data.code !== "validation_error" || typeof data.message !== "string") return false
  const m = data.message.toLowerCase()
  return m.includes("sort property") || m.includes("sort property with name")
}

async function queryTasksDatabase(options: QueryTasksDatabaseOptions): Promise<QueryDatabaseResponse> {
  const notionApiKey = process.env.NOTION_API_KEY
  if (!notionApiKey) {
    throw new Error("NOTION_API_KEY is not set")
  }

  const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`
  const headers = {
    Authorization: `Bearer ${notionApiKey}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  }

  let response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(options),
  })

  let responseData = await response.json()

  // Retry without sorts if property names differ (e.g. "Due date" vs "Due Date").
  if (
    !response.ok &&
    options.sorts &&
    options.sorts.length > 0 &&
    isSortPropertyNotFoundError(responseData)
  ) {
    const { sorts: _removed, ...withoutSorts } = options
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(withoutSorts),
    })
    responseData = await response.json()
  }

  if (!response.ok) {
    const code = typeof responseData?.code === "string" ? responseData.code : "unknown_error"
    const message =
      typeof responseData?.message === "string" ? responseData.message : "Failed to query Notion database"
    throw new Error(`${code}: ${message}`)
  }

  return responseData as QueryDatabaseResponse
}

function extractTasks(response: QueryDatabaseResponse): Task[] {
  return response.results
    .filter((page: any): page is PageObjectResponse => "properties" in page)
    .map(extractTaskFromPage)
}

function truncateComment(comment: string, maxLength: number = 120): string {
  if (comment.length <= maxLength) return comment
  return `${comment.slice(0, maxLength - 3)}...`
}

async function getCommentSummary(pageId: string): Promise<Pick<Task, "latestComment" | "commentCount">> {
  try {
    const commentsResponse = await notion.comments.list({
      block_id: pageId,
      page_size: 50,
    })

    const comments = commentsResponse.results
      .map((comment: any) => {
        if (!("rich_text" in comment)) return null
        const text = comment.rich_text
          .map((token: any) => ("plain_text" in token ? token.plain_text : ""))
          .join("")
          .trim()
        if (!text) return null
        return {
          text,
          createdTime: "created_time" in comment ? comment.created_time : "",
        }
      })
      .filter(
        (comment: { text: string; createdTime: string } | null): comment is { text: string; createdTime: string } =>
          Boolean(comment)
      )

    if (comments.length === 0) {
      return { latestComment: null, commentCount: 0 }
    }

    const latestComment = comments.reduce(
      (latest: { text: string; createdTime: string }, current: { text: string; createdTime: string }) => {
        if (new Date(current.createdTime).getTime() > new Date(latest.createdTime).getTime()) return current
        return latest
      }
    )

    return {
      latestComment: truncateComment(latestComment.text),
      commentCount: comments.length,
    }
  } catch (error) {
    console.warn(`[v0] Could not fetch comments for page ${pageId}:`, error)
    return { latestComment: null, commentCount: 0 }
  }
}

async function enrichTasksWithComments(tasks: Task[]): Promise<Task[]> {
  return Promise.all(
    tasks.map(async (task) => {
      const commentSummary = await getCommentSummary(task.id)
      return { ...task, ...commentSummary }
    })
  )
}

const todayIso = () => new Date().toISOString().split("T")[0]

export async function getTodayTasks(): Promise<Task[]> {
  const today = todayIso()
  const dueEq = buildDateEqualsFilter(DUE_DATE_PROPERTY, today)
  const shootEq = buildDateEqualsFilter(SHOOT_LIVE_DATE_PROPERTY, today)
  const combined = buildOptionalOrFilter(compactFilters([dueEq, shootEq]))
  if (!combined) {
    throw new Error("Date filters are not configured. Set NOTION_DUE_DATE_PROPERTY in Vercel to your exact Due column name.")
  }

  try {
    return await runTodayQuery(combined)
  } catch (e) {
    if (!isFilterValidationError(e)) throw e
    if (dueEq) {
      try {
        return await runTodayQuery(dueEq)
      } catch (e2) {
        if (!isFilterValidationError(e2)) throw e2
      }
    }
    if (shootEq) {
      return await runTodayQuery(shootEq)
    }
    throw e
  }
}

async function runUpcomingQuery(dateRangeFilter: Record<string, unknown>): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [dateRangeFilter, ...buildActiveTaskFilters()],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })
  return enrichTasksWithComments(extractTasks(response))
}

export async function getUpcomingTasks(days: number = 7): Promise<Task[]> {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(today.getDate() + days)
  const start = today.toISOString().split("T")[0]
  const end = futureDate.toISOString().split("T")[0]
  const dueRange = buildDateRangeFilter(DUE_DATE_PROPERTY, start, end)
  const shootRange = buildDateRangeFilter(SHOOT_LIVE_DATE_PROPERTY, start, end)
  const dateRangeFilter = buildOptionalOrFilter(compactFilters([dueRange, shootRange]))
  if (!dateRangeFilter) {
    throw new Error("Date range filters are not configured. Set NOTION_DUE_DATE_PROPERTY in Vercel.")
  }

  try {
    return await runUpcomingQuery(dateRangeFilter)
  } catch (e) {
    if (!isFilterValidationError(e)) throw e
    if (dueRange) {
      try {
        return await runUpcomingQuery(dueRange)
      } catch (e2) {
        if (!isFilterValidationError(e2)) throw e2
      }
    }
    if (shootRange) {
      return await runUpcomingQuery(shootRange)
    }
    throw e
  }
}

export async function getInProgressTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      ...buildStatusEqualsFilter(STATUS_IN_PROGRESS),
    },
    sorts: safeSorts(
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Intake → Scheduled (template “team queue”). */
export async function getPipelineQueueTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [buildStatusOrEqualsFilter(PIPELINE_QUEUE_STATUSES), ...buildActiveTaskFilters()],
    },
    sorts: safeSorts(
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Internal + client review. */
export async function getReviewTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [buildStatusOrEqualsFilter(REVIEW_STATUSES), ...buildActiveTaskFilters()],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Blocked by text filled, or status On hold. */
export async function getBlockedTasks(): Promise<Task[]> {
  const orFilters: Record<string, unknown>[] = []

  if (BLOCKED_BY_PROPERTY) {
    orFilters.push({
      property: BLOCKED_BY_PROPERTY,
      rich_text: { is_not_empty: true },
    })
  }
  if (STATUS_ON_HOLD.trim()) {
    orFilters.push(buildStatusEqualsFilter(STATUS_ON_HOLD))
  }
  const blockedFilter = buildOptionalOrFilter(orFilters)
  if (!blockedFilter) {
    throw new Error(
      "Blocked filter is not configured. Set NOTION_BLOCKED_BY_PROPERTY and/or NOTION_STATUS_ON_HOLD."
    )
  }

  const response = await queryTasksDatabase({
    filter: {
      and: [
        blockedFilter,
        buildStatusDoesNotEqualFilter(STATUS_DONE),
      ],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getNotStartedTasks(): Promise<Task[]> {
  return getPipelineQueueTasks()
}

export async function getAllIncompleteTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: buildActiveTaskFilters(),
    },
    sorts: safeSorts(
      { property: STATUS_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function searchTasks(query: string): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [
        {
          property: TASK_NAME_PROPERTY,
          title: { contains: query },
        },
        ...buildActiveTaskFilters(),
      ],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getOverdueTasks(): Promise<Task[]> {
  const today = todayIso()

  const response = await queryTasksDatabase({
    filter: {
      and: [
        { property: DUE_DATE_PROPERTY, date: { before: today } },
        ...buildActiveTaskFilters(),
      ],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Filter by exact Notion status name (select or status property). */
export async function getTasksByNotionStatus(statusName: string): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      ...buildStatusEqualsFilter(statusName),
    },
    sorts: safeSorts(
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Legacy AI mapping → Notion status labels. */
export async function getTasksByStatus(status: "Not started" | "In progress" | "Done"): Promise<Task[]> {
  if (status === "Done") return getTasksByNotionStatus(STATUS_DONE)
  if (status === "In progress") return getInProgressTasks()
  return getPipelineQueueTasks()
}

export async function getTasksByServiceLine(serviceLine: string): Promise<Task[]> {
  if (!SERVICE_LINE_PROPERTY) {
    return []
  }
  const response = await queryTasksDatabase({
    filter: {
      and: [
        {
          property: SERVICE_LINE_PROPERTY,
          select: { equals: serviceLine },
        },
        ...buildActiveTaskFilters(),
      ],
    },
    sorts: safeSorts({ property: DUE_DATE_PROPERTY, direction: "ascending" }),
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getAllTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: buildActiveTaskFilters(),
    },
    sorts: safeSorts(
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
      { property: STATUS_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Active tasks where Assignee includes this Notion user (matches `people.contains` in API). */
export async function getMyAssignedTasks(notionUserId: string): Promise<Task[]> {
  const assigneeFilter: Record<string, unknown> = {
    property: ASSIGNEE_PROPERTY,
    people: { contains: notionUserId.trim() },
  }
  const response = await queryTasksDatabase({
    filter: {
      and: [assigneeFilter, ...buildActiveTaskFilters()],
    },
    sorts: safeSorts(
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
      { property: STATUS_PROPERTY, direction: "ascending" }
    ),
  })

  return enrichTasksWithComments(extractTasks(response))
}

function statusEmoji(status: string): string {
  const s = status.toLowerCase()
  if (s.includes("done") || s.includes("published")) return "✅"
  if (s.includes("review") || s.includes("revision")) return "👀"
  if (s.includes("production") || s.includes("progress")) return "🔄"
  if (s.includes("hold") || s.includes("blocked")) return "🚫"
  if (s.includes("intake") || s.includes("brief") || s.includes("scheduled")) return "📥"
  return "⏳"
}

function formatTaskDetailLines(task: Task): string {
  const parts: string[] = []
  parts.push(`   ${statusEmoji(task.status)} ${task.status}`)
  if (task.client) parts.push(`   Client: ${task.client}`)
  if (task.serviceLine) parts.push(`   Service: ${task.serviceLine}`)
  if (task.deliverable) parts.push(`   Deliverable: ${task.deliverable}`)
  if (task.priority) parts.push(`   Priority: ${task.priority}`)
  const due = task.dueDate ? `Due: ${formatDate(task.dueDate)}` : "No due date"
  const shoot =
    task.shootOrLiveDate && SHOOT_LIVE_DATE_PROPERTY
      ? ` | Shoot/Live: ${formatDate(task.shootOrLiveDate)}`
      : ""
  parts.push(`   ${due}${shoot}`)
  if (task.assignee) parts.push(`   Assignee: ${task.assignee}`)
  if (task.collaborators) parts.push(`   Collaborators: ${task.collaborators}`)
  if (task.reviewer) parts.push(`   Reviewer: ${task.reviewer}`)
  if (task.clientApproval) parts.push(`   Client approval: ${task.clientApproval}`)
  if (task.blockedBy) parts.push(`   Blocked: ${task.blockedBy}`)
  if (task.campaign) parts.push(`   Campaign: ${task.campaign}`)
  if (task.channels) parts.push(`   Channels: ${task.channels}`)
  if (task.briefLink) parts.push(`   Brief: ${task.briefLink}`)
  if (task.assetsLink) parts.push(`   Assets: ${task.assetsLink}`)
  if (task.internalNotes) {
    const note =
      task.internalNotes.length > 100 ? `${task.internalNotes.slice(0, 97)}...` : task.internalNotes
    parts.push(`   Notes: ${note}`)
  }
  if (task.commentCount > 0) {
    parts.push(`   💬 Comments (${task.commentCount}): ${task.latestComment}`)
  }
  return parts.join("\n")
}

export function formatTasksForTelegram(tasks: Task[], title: string): string {
  if (tasks.length === 0) {
    return `${title}\n\nNo tasks found.`
  }

  const taskLines = tasks.map((task, index) => {
    return `${index + 1}. ${task.name}\n${formatTaskDetailLines(task)}`
  })

  return `${title}\n\n${taskLines.join("\n\n")}`
}

export function formatTaskSummaryLine(task: Task, index: number): string {
  return `${index + 1}. ${task.name}\n${formatTaskDetailLines(task)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (dateStr === today.toISOString().split("T")[0]) return "Today"
  if (dateStr === tomorrow.toISOString().split("T")[0]) return "Tomorrow"

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
