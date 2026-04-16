import { Client } from "@notionhq/client"
import {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints"

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

// Database + properties (override via env to match your Notion DB)
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "3428ab25d01e806eb5f0eaf1a1871aff"
const TASK_NAME_PROPERTY = process.env.NOTION_TASK_NAME_PROPERTY || "Name"
const DUE_DATE_PROPERTY = process.env.NOTION_DUE_DATE_PROPERTY || "Due Date"
const SHOOT_LIVE_DATE_PROPERTY = (process.env.NOTION_SHOOT_LIVE_DATE_PROPERTY ?? "Shoot / live date").trim()
const STATUS_PROPERTY = process.env.NOTION_STATUS_PROPERTY || "Status"
const ASSIGNEE_PROPERTY = process.env.NOTION_ASSIGNEE_PROPERTY || "Assignee"
const COLLABORATORS_PROPERTY = (process.env.NOTION_COLLABORATORS_PROPERTY ?? "Collaborators").trim()
const REVIEWER_PROPERTY = (process.env.NOTION_REVIEWER_PROPERTY ?? "Reviewer").trim()
const CLIENT_PROPERTY = (process.env.NOTION_CLIENT_PROPERTY ?? "Client").trim()
const SERVICE_LINE_PROPERTY = (process.env.NOTION_SERVICE_LINE_PROPERTY ?? "Service line").trim()
const DELIVERABLE_PROPERTY = (process.env.NOTION_DELIVERABLE_PROPERTY ?? "Deliverable").trim()
const PRIORITY_PROPERTY = (process.env.NOTION_PRIORITY_PROPERTY ?? "Priority").trim()
const CHANNELS_PROPERTY = (process.env.NOTION_CHANNELS_PROPERTY ?? "Channels").trim()
const BRIEF_LINK_PROPERTY = (process.env.NOTION_BRIEF_LINK_PROPERTY ?? "Brief link").trim()
const ASSETS_LINK_PROPERTY = (process.env.NOTION_ASSETS_LINK_PROPERTY ?? "Assets link").trim()
const INTERNAL_NOTES_PROPERTY = (process.env.NOTION_INTERNAL_NOTES_PROPERTY ?? "Internal notes").trim()
const BLOCKED_BY_PROPERTY = (process.env.NOTION_BLOCKED_BY_PROPERTY ?? "Blocked by").trim()
const CLIENT_APPROVAL_PROPERTY = (process.env.NOTION_CLIENT_APPROVAL_PROPERTY ?? "Client approval").trim()
const CAMPAIGN_PROPERTY = (process.env.NOTION_CAMPAIGN_PROPERTY ?? "Campaign").trim()

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

function buildDateEqualsFilter(propertyName: string, dateValue: string): Record<string, unknown> | null {
  const property = propertyName.trim()
  if (!property) return null
  return {
    property,
    date: { equals: dateValue },
  }
}

function buildDateRangeFilter(
  propertyName: string,
  start: string,
  end: string
): Record<string, unknown> | null {
  const property = propertyName.trim()
  if (!property) return null
  return {
    and: [
      { property, date: { on_or_after: start } },
      { property, date: { on_or_before: end } },
    ],
  }
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

async function queryTasksDatabase(options: QueryTasksDatabaseOptions): Promise<QueryDatabaseResponse> {
  const notionApiKey = process.env.NOTION_API_KEY
  if (!notionApiKey) {
    throw new Error("NOTION_API_KEY is not set")
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  })

  const responseData = await response.json()
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
  const dateOrBranches = compactFilters([
    buildDateEqualsFilter(DUE_DATE_PROPERTY, today),
    buildDateEqualsFilter(SHOOT_LIVE_DATE_PROPERTY, today),
  ])
  const dateFilter = buildOptionalOrFilter(dateOrBranches)
  if (!dateFilter) {
    throw new Error("Date filters are not configured. Set NOTION_DUE_DATE_PROPERTY in env.")
  }

  const response = await queryTasksDatabase({
    filter: {
      and: [dateFilter, ...buildActiveTaskFilters()],
    },
    sorts: [
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: STATUS_PROPERTY, direction: "ascending" },
    ],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getUpcomingTasks(days: number = 7): Promise<Task[]> {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(today.getDate() + days)
  const start = today.toISOString().split("T")[0]
  const end = futureDate.toISOString().split("T")[0]
  const dateRangeBranches = compactFilters([
    buildDateRangeFilter(DUE_DATE_PROPERTY, start, end),
    buildDateRangeFilter(SHOOT_LIVE_DATE_PROPERTY, start, end),
  ])
  const dateRangeFilter = buildOptionalOrFilter(dateRangeBranches)
  if (!dateRangeFilter) {
    throw new Error("Date range filters are not configured. Set NOTION_DUE_DATE_PROPERTY in env.")
  }

  const response = await queryTasksDatabase({
    filter: {
      and: [
        dateRangeFilter,
        ...buildActiveTaskFilters(),
      ],
    },
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getInProgressTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      ...buildStatusEqualsFilter(STATUS_IN_PROGRESS),
    },
    sorts: [
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
    ],
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Intake → Scheduled (template “team queue”). */
export async function getPipelineQueueTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [buildStatusOrEqualsFilter(PIPELINE_QUEUE_STATUSES), ...buildActiveTaskFilters()],
    },
    sorts: [
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
    ],
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Internal + client review. */
export async function getReviewTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: [buildStatusOrEqualsFilter(REVIEW_STATUSES), ...buildActiveTaskFilters()],
    },
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
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
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
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
    sorts: [
      { property: STATUS_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
    ],
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
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
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
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

/** Filter by exact Notion status name (select or status property). */
export async function getTasksByNotionStatus(statusName: string): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      ...buildStatusEqualsFilter(statusName),
    },
    sorts: [
      { property: PRIORITY_PROPERTY, direction: "ascending" },
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
    ],
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
    sorts: [{ property: DUE_DATE_PROPERTY, direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getAllTasks(): Promise<Task[]> {
  const response = await queryTasksDatabase({
    filter: {
      and: buildActiveTaskFilters(),
    },
    sorts: [
      { property: DUE_DATE_PROPERTY, direction: "ascending" },
      { property: STATUS_PROPERTY, direction: "ascending" },
    ],
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
  if (task.assignee) parts.push(`   Owner: ${task.assignee}`)
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
