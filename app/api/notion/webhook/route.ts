import { NextRequest, NextResponse } from "next/server"
import { sendMessage } from "@/lib/telegram"
import { handleNotionWebhookForAssignments } from "@/lib/notion-assignment-notify"

let pendingVerificationToken: string | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (process.env.NOTION_WEBHOOK_DEBUG === "true") {
      console.log("[notion-webhook] event type:", body?.type, "entity:", body?.entity?.id)
    }

    if (body.verification_token) {
      pendingVerificationToken = body.verification_token
      return NextResponse.json({
        challenge: body.verification_token,
      })
    }

    // Official Notion webhooks: top-level `type` + `entity` (see Notion docs).
    if (body.type && typeof body.type === "string") {
      try {
        await handleNotionWebhookForAssignments(body as Record<string, unknown>)
      } catch (assignmentErr) {
        console.error("[notion-webhook] assignment notify error:", assignmentErr)
      }

      // Optional legacy: single chat for non-assignment events (e.g. page.deleted).
      const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim()
      if (legacyChatId && body.type === "page.deleted") {
        await sendMessage(
          legacyChatId,
          "A Notion page was deleted. Check Production if something looks missing.",
          {}
        )
      }

      return NextResponse.json({ success: true })
    }

    // Very old shape (if any automation still posts this)
    if (body.type && body.data && !body.entity) {
      const eventType = body.type as string
      const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim()
      if (legacyChatId) {
        let message = ""
        switch (eventType) {
          case "page.created":
            message = "New task created in Notion."
            break
          case "page.updated":
            message = "A Notion page was updated."
            break
          case "page.deleted":
            message = "A Notion page was removed."
            break
          default:
            message = `Notion event: ${eventType}`
        }
        await sendMessage(legacyChatId, message, {})
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[notion-webhook] error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Notion webhook endpoint is active",
    pendingVerification: pendingVerificationToken ? "yes" : "no",
  })
}
