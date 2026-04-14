import { NextResponse } from "next/server"
import { setWebhook, deleteWebhook, getWebhookInfo, getBotInfo } from "@/lib/telegram"

export async function POST(request: Request) {
  try {
    const { action, webhookUrl } = await request.json()

    if (action === "set" && webhookUrl) {
      const result = await setWebhook(webhookUrl)
      return NextResponse.json(result)
    }

    if (action === "delete") {
      const result = await deleteWebhook()
      return NextResponse.json(result)
    }

    if (action === "info") {
      const webhookInfo = await getWebhookInfo()
      const botInfo = await getBotInfo()
      return NextResponse.json({ webhook: webhookInfo, bot: botInfo })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Setup error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const webhookInfo = await getWebhookInfo()
    const botInfo = await getBotInfo()
    return NextResponse.json({ webhook: webhookInfo, bot: botInfo })
  } catch (error) {
    console.error("[v0] Get info error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
