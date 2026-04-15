import { Client } from "@notionhq/client"
import { 
  PageObjectResponse, 
  QueryDatabaseResponse 
} from "@notionhq/client/build/src/api-endpoints"

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

// Your Notion database ID
const DATABASE_ID = "3428ab25d01e80d59fbac3783a7b2d3e"

export interface Task {
  id: string
  name: string
  status: "Not started" | "In progress" | "Done"
  dueDate: string | null
  assignee: string | null
  latestComment: string | null
  commentCount: number
}

function extractTaskFromPage(page: PageObjectResponse): Task {
  const properties = page.properties

  // Extract task name (title property)
  let name = "Untitled"
  const taskNameProp = properties["Task name"]
  if (taskNameProp?.type === "title" && taskNameProp.title.length > 0) {
    name = taskNameProp.title.map((t: any) => t.plain_text).join("")
  }

  // Extract status
  let status: Task["status"] = "Not started"
  const statusProp = properties["Status"]
  if (statusProp?.type === "status" && statusProp.status) {
    status = statusProp.status.name as Task["status"]
  }

  // Extract due date
  let dueDate: string | null = null
  const dueDateProp = properties["Due date"]
  if (dueDateProp?.type === "date" && dueDateProp.date) {
    dueDate = dueDateProp.date.start
  }

  // Extract assignee
  let assignee: string | null = null
  const assigneeProp = properties["Assignee"]
  if (assigneeProp?.type === "people" && assigneeProp.people.length > 0) {
    const person = assigneeProp.people[0]
    if ("name" in person && person.name) {
      assignee = person.name
    }
  }

  return {
    id: page.id,
    name,
    status,
    dueDate,
    assignee,
    latestComment: null,
    commentCount: 0,
  }
}

function extractTasks(response: QueryDatabaseResponse): Task[] {
  return response.results
    .filter((page: any): page is PageObjectResponse => "properties" in page)
    .map(extractTaskFromPage)
}

function truncateComment(comment: string, maxLength: number = 120): string {
  if (comment.length <= maxLength) {
    return comment
  }
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
        if (!("rich_text" in comment)) {
          return null
        }

        const text = comment.rich_text
          .map((token: any) => ("plain_text" in token ? token.plain_text : ""))
          .join("")
          .trim()

        if (!text) {
          return null
        }

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

    const latestComment = comments.reduce((latest: { text: string; createdTime: string }, current: { text: string; createdTime: string }) => {
      if (new Date(current.createdTime).getTime() > new Date(latest.createdTime).getTime()) {
        return current
      }
      return latest
    })

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
      return {
        ...task,
        ...commentSummary,
      }
    })
  )
}

export async function getTodayTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split("T")[0]

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        {
          property: "Due date",
          date: {
            equals: today,
          },
        },
        {
          property: "Status",
          status: {
            does_not_equal: "Done",
          },
        },
      ],
    },
    sorts: [{ property: "Status", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getUpcomingTasks(days: number = 7): Promise<Task[]> {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(today.getDate() + days)

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        {
          property: "Due date",
          date: {
            on_or_after: today.toISOString().split("T")[0],
          },
        },
        {
          property: "Due date",
          date: {
            on_or_before: futureDate.toISOString().split("T")[0],
          },
        },
        {
          property: "Status",
          status: {
            does_not_equal: "Done",
          },
        },
      ],
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getInProgressTasks(): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: {
        equals: "In progress",
      },
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getNotStartedTasks(): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: {
        equals: "Not started",
      },
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getAllIncompleteTasks(): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: {
        does_not_equal: "Done",
      },
    },
    sorts: [
      { property: "Status", direction: "ascending" },
      { property: "Due date", direction: "ascending" },
    ],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function searchTasks(query: string): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        {
          property: "Task name",
          title: {
            contains: query,
          },
        },
        {
          property: "Status",
          status: {
            does_not_equal: "Done",
          },
        },
      ],
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getOverdueTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split("T")[0]

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        {
          property: "Due date",
          date: {
            before: today,
          },
        },
        {
          property: "Status",
          status: {
            does_not_equal: "Done",
          },
        },
      ],
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getTasksByStatus(status: "Not started" | "In progress" | "Done"): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: {
        equals: status,
      },
    },
    sorts: [{ property: "Due date", direction: "ascending" }],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export async function getAllTasks(): Promise<Task[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: {
        does_not_equal: "Done",
      },
    },
    sorts: [
      { property: "Due date", direction: "ascending" },
      { property: "Status", direction: "ascending" },
    ],
  })

  return enrichTasksWithComments(extractTasks(response))
}

export function formatTasksForTelegram(tasks: Task[], title: string): string {
  if (tasks.length === 0) {
    return `${title}\n\nNo tasks found.`
  }

  const taskLines = tasks.map((task, index) => {
    const statusIcon =
      task.status === "In progress" ? "🔄" : task.status === "Done" ? "✅" : "⏳"
    const dueDateStr = task.dueDate
      ? `Due: ${formatDate(task.dueDate)}`
      : "No due date"
    const assigneeStr = task.assignee ? `Assigned to: ${task.assignee}` : ""
    const commentsStr = task.commentCount > 0 ? `\n   💬 Comments (${task.commentCount}): ${task.latestComment}` : ""

    return `${index + 1}. ${task.name}\n   ${statusIcon} ${task.status} | ${dueDateStr}${assigneeStr ? ` | ${assigneeStr}` : ""}${commentsStr}`
  })

  return `${title}\n\n${taskLines.join("\n\n")}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (dateStr === today.toISOString().split("T")[0]) {
    return "Today"
  }
  if (dateStr === tomorrow.toISOString().split("T")[0]) {
    return "Tomorrow"
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
