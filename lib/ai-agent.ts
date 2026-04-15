"use server"

import { generateText, tool } from "ai"
import { z } from "zod"
import {
  getTodayTasks,
  getUpcomingTasks,
  getOverdueTasks,
  getTasksByStatus,
  searchTasks,
  getAllTasks,
  type Task,
} from "./notion-tasks"

function formatTasksForDisplay(tasks: Task[], title: string): string {
  if (tasks.length === 0) {
    return `${title}\n\nNo tasks found.`
  }

  const taskList = tasks
    .map((task, index) => {
      const statusEmoji =
        task.status === "Done" ? "✅" : task.status === "In progress" ? "🔄" : "⏳"
      const dueDateStr = task.dueDate ? ` (Due: ${task.dueDate})` : ""
      const assigneeStr = task.assignee ? ` - ${task.assignee}` : ""
      const commentStr =
        task.commentCount > 0 && task.latestComment
          ? `\n   💬 ${task.commentCount} comment${task.commentCount > 1 ? "s" : ""}: ${task.latestComment}`
          : ""
      return `${index + 1}. ${statusEmoji} ${task.name}${dueDateStr}${assigneeStr}${commentStr}`
    })
    .join("\n")

  return `${title}\n\n${taskList}`
}

export async function processUserMessage(userMessage: string): Promise<string> {
  const tools = {
    getTodayTasks: tool({
      description: "Get all tasks that are due today",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getTodayTasks()
        return formatTasksForDisplay(tasks, "📅 Tasks Due Today")
      },
    }),

    getUpcomingTasks: tool({
      description: "Get tasks due in the next 7 days (upcoming tasks)",
      inputSchema: z.object({
        days: z.number().default(7).describe("Number of days to look ahead"),
      }),
      execute: async ({ days }) => {
        const tasks = await getUpcomingTasks(days)
        return formatTasksForDisplay(tasks, `📆 Upcoming Tasks (Next ${days} Days)`)
      },
    }),

    getOverdueTasks: tool({
      description: "Get all overdue tasks (past due date and not completed)",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getOverdueTasks()
        return formatTasksForDisplay(tasks, "⚠️ Overdue Tasks")
      },
    }),

    getTasksByStatus: tool({
      description: "Get tasks filtered by their status",
      inputSchema: z.object({
        status: z
          .enum(["Not started", "In progress", "Done"])
          .describe("The status to filter tasks by"),
      }),
      execute: async ({ status }) => {
        const tasks = await getTasksByStatus(status)
        const emoji =
          status === "Done" ? "✅" : status === "In progress" ? "🔄" : "⏳"
        return formatTasksForDisplay(tasks, `${emoji} Tasks: ${status}`)
      },
    }),

    searchTasks: tool({
      description: "Search for tasks by name or keyword",
      inputSchema: z.object({
        query: z.string().describe("The search term to find in task names"),
      }),
      execute: async ({ query }) => {
        const tasks = await searchTasks(query)
        return formatTasksForDisplay(tasks, `🔍 Search Results for "${query}"`)
      },
    }),

    getAllTasks: tool({
      description: "Get all tasks from the database",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getAllTasks()
        return formatTasksForDisplay(tasks, "📋 All Tasks")
      },
    }),
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const result = await generateText({
    model: "openai/gpt-4o-mini",
    system: `You are a helpful task management assistant connected to the user's Notion task database.
Today's date is: ${today}

Your job is to help users understand their tasks and what they need to do. You can:
- Show tasks due today
- Show upcoming tasks for the next few days
- Find overdue tasks
- Filter tasks by status (Not started, In progress, Done)
- Search for specific tasks by name

When the user asks about their tasks, use the appropriate tool to fetch the information and then provide a helpful, concise response.

If the user asks vague questions like "what should I do?" or "what to do?", show them:
1. First check for overdue tasks
2. Then show today's tasks
3. If no urgent tasks, show upcoming tasks

Always be friendly and encouraging. Keep responses concise but helpful.`,
    prompt: userMessage,
    tools,
    maxSteps: 5,
  })

  return result.text || "I couldn't process your request. Please try again."
}
