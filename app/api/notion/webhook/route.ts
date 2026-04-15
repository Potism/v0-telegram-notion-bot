import { NextRequest, NextResponse } from "next/server"
import { sendMessage } from "@/lib/telegram"

// Store the verification token temporarily (in production, use a database)
let pendingVerificationToken: string | null = null

// Handle Notion webhook verification and events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log("[v0] Notion webhook received:", JSON.stringify(body, null, 2))

    // Handle verification request from Notion
    if (body.verification_token) {
      console.log("[v0] Verification token received:", body.verification_token)
      pendingVerificationToken = body.verification_token
      
      // Notion expects the verification token to be returned
      return NextResponse.json({ 
        challenge: body.verification_token 
      })
    }

    // Handle actual webhook events
    if (body.type && body.data) {
      const eventType = body.type
      const data = body.data
      
      // Get the Telegram chat ID from environment (you'll need to set this)
      const chatId = process.env.TELEGRAM_CHAT_ID
      
      if (chatId) {
        let message = ""
        
        switch (eventType) {
          case "page.created":
            message = `📝 *New task created*\n\nA new page was added to your Notion workspace.`
            break
          case "page.updated":
            message = `✏️ *Task updated*\n\nA page was updated in your Notion workspace.`
            break
          case "page.deleted":
            message = `🗑️ *Task deleted*\n\nA page was removed from your Notion workspace.`
            break
          default:
            message = `📌 *Notion event*: ${eventType}`
        }
        
        await sendMessage(chatId, message)
      }
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Notion webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

// Handle GET requests (for manual verification check)
export async function GET() {
  return NextResponse.json({
    status: "Notion webhook endpoint is active",
    pendingVerification: pendingVerificationToken ? "Yes" : "No",
    verificationToken: pendingVerificationToken || "No token received yet. Click 'Resend token' in Notion first.",
  })
}
