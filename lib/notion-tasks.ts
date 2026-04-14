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
}

function extractTaskFromPage(page: PageObjectResponse): Task {
  const properties = page.properties

  // Extract task name (title property)
  let name = "Untitled"
  const taskNameProp = properties["Task name"]
  if (taskNameProp?.type === "title" && taskNameProp.title.length > 0) {
    name = taskNameProp.title.map((t) => t.plain_text).join("")
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
  }
}

function extractTasks(response: QueryDatabaseResponse): Task[] {
  return response.results
    .filter((page): page is PageObjectResponse => "properties" in page)
    .map(extractTaskFromPage)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

  return extractTasks(response)
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

    return `${index + 1}. ${task.name}\n   ${statusIcon} ${task.status} | ${dueDateStr}${assigneeStr ? ` | ${assigneeStr}` : ""}`
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
