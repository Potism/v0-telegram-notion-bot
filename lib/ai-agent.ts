"use server"

import { generateText, tool } from "ai"
import { z } from "zod"
import {
  getTodayTasks,
  getUpcomingTasks,
  getOverdueTasks,
  getTasksByStatus,
  getTasksByNotionStatus,
  getTasksByServiceLine,
  searchTasks,
  getAllTasks,
  getPipelineQueueTasks,
  getReviewTasks,
  getBlockedTasks,
  getInProgressTasks,
  formatTasksForTelegram,
} from "./notion-tasks"

export async function processUserMessage(userMessage: string): Promise<string> {
  const tools = {
    getTodayTasks: tool({
      description: "Tasks due today OR shoot/live date today (Anvance Production board)",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getTodayTasks()
        return formatTasksForTelegram(tasks, "📅 Today (due or shoot/live)")
      },
    }),

    getUpcomingTasks: tool({
      description: "Tasks with due date or shoot/live in the next N days",
      inputSchema: z.object({
        days: z.number().default(7).describe("Days ahead"),
      }),
      execute: async ({ days }) => {
        const tasks = await getUpcomingTasks(days)
        return formatTasksForTelegram(tasks, `📆 Upcoming (next ${days} days)`)
      },
    }),

    getOverdueTasks: tool({
      description: "Tasks past due date, excluding Done/On hold",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getOverdueTasks()
        return formatTasksForTelegram(tasks, "⚠️ Overdue")
      },
    }),

    getInProductionTasks: tool({
      description: "Tasks in status In production",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getInProgressTasks()
        return formatTasksForTelegram(tasks, "🔄 In production")
      },
    }),

    getPipelineQueueTasks: tool({
      description: "Intake / Briefing / Scheduled — team queue before production",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getPipelineQueueTasks()
        return formatTasksForTelegram(tasks, "📥 Team queue")
      },
    }),

    getReviewTasks: tool({
      description: "Internal review + Client review",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getReviewTasks()
        return formatTasksForTelegram(tasks, "👀 Needs review")
      },
    }),

    getBlockedTasks: tool({
      description: "Blocked by field filled OR status On hold",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getBlockedTasks()
        return formatTasksForTelegram(tasks, "🚫 Blocked / on hold")
      },
    }),

    getTasksByNotionStatus: tool({
      description:
        "Exact Notion status name: Intake, Briefing, Scheduled, In production, Internal review, Client review, Revisions, Approved, Published, Reporting, Done, On hold",
      inputSchema: z.object({
        statusName: z.string().describe("Exact status label from Notion"),
      }),
      execute: async ({ statusName }) => {
        const tasks = await getTasksByNotionStatus(statusName)
        return formatTasksForTelegram(tasks, `📌 Status: ${statusName}`)
      },
    }),

    getTasksByServiceLine: tool({
      description: "Filter by service line: Photo, Video, Social, Ads, Strategy",
      inputSchema: z.object({
        serviceLine: z.enum(["Photo", "Video", "Social", "Ads", "Strategy"]),
      }),
      execute: async ({ serviceLine }) => {
        const tasks = await getTasksByServiceLine(serviceLine)
        return formatTasksForTelegram(tasks, `🎬 ${serviceLine}`)
      },
    }),

    getTasksByStatusLegacy: tool({
      description: "Legacy buckets: Not started (queue), In progress (in production), Done",
      inputSchema: z.object({
        status: z.enum(["Not started", "In progress", "Done"]),
      }),
      execute: async ({ status }) => {
        const tasks = await getTasksByStatus(status)
        return formatTasksForTelegram(tasks, `📋 ${status}`)
      },
    }),

    searchTasks: tool({
      description: "Search task title (Name) by keyword",
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        const tasks = await searchTasks(query)
        return formatTasksForTelegram(tasks, `🔍 "${query}"`)
      },
    }),

    getAllActiveTasks: tool({
      description: "All active tasks (not Done, not On hold)",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getAllTasks()
        return formatTasksForTelegram(tasks, "📋 All active")
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
    system: `You are the Anvance Production assistant. The team does social marketing, photo/video, social management, ads, and strategy. Tasks live in Notion with a full pipeline.

Today's date: ${today}

Notion statuses (exact labels): Intake, Briefing, Scheduled, In production, Internal review, Client review, Revisions, Approved, Published, Reporting, Done, On hold.

Use tools to fetch data. Prefer:
- getTodayTasks for "today"
- getPipelineQueueTasks for queue / intake / not started work
- getInProductionTasks for active editing/shoots
- getReviewTasks for approvals
- getBlockedTasks for blockers
- getOverdueTasks for late items
- getTasksByNotionStatus for a specific status
- getTasksByServiceLine for Photo/Video/Social/Ads/Strategy

If the user is vague ("what should we do?"), order: overdue → today → in production → review queue.

Keep answers concise; task lists already include client, owner, priority, links when present.`,
    prompt: userMessage,
    tools,
    maxSteps: 6,
  })

  return result.text || "I couldn't process your request. Please try again."
}
