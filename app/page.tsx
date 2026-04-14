"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, XCircle, ExternalLink, Copy, MessageSquare, Database, Bot } from "lucide-react"

interface BotInfo {
  ok: boolean
  result?: {
    username: string
    first_name: string
  }
}

interface WebhookInfo {
  ok: boolean
  result?: {
    url: string
    pending_update_count: number
    last_error_message?: string
  }
}

export default function SetupPage() {
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchStatus()
    // Auto-fill webhook URL based on current domain
    if (typeof window !== "undefined") {
      const baseUrl = window.location.origin
      setWebhookUrl(`${baseUrl}/api/telegram/webhook`)
    }
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/telegram/setup")
      const data = await res.json()
      setBotInfo(data.bot)
      setWebhookInfo(data.webhook)
    } catch {
      console.error("Failed to fetch status")
    }
  }

  const handleSetWebhook = async () => {
    setLoading(true)
    setStatus("idle")
    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", webhookUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus("success")
        setMessage("Webhook set successfully! Your bot is now active.")
        fetchStatus()
      } else {
        setStatus("error")
        setMessage(data.description || "Failed to set webhook")
      }
    } catch {
      setStatus("error")
      setMessage("Failed to connect to the server")
    }
    setLoading(false)
  }

  const handleDeleteWebhook = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus("success")
        setMessage("Webhook deleted successfully")
        fetchStatus()
      } else {
        setStatus("error")
        setMessage(data.description || "Failed to delete webhook")
      }
    } catch {
      setStatus("error")
      setMessage("Failed to connect to the server")
    }
    setLoading(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isWebhookActive = webhookInfo?.result?.url && webhookInfo.result.url.length > 0

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Notion Task Bot
          </h1>
          <p className="text-muted-foreground">
            Connect your Telegram bot to manage Notion tasks
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Telegram Bot
              </CardTitle>
            </CardHeader>
            <CardContent>
              {botInfo?.ok ? (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    @{botInfo.result?.username}
                  </span>
                </div>
              ) : (
                <Badge variant="destructive" className="bg-destructive/10">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Webhook Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isWebhookActive ? (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  Not Configured
                </Badge>
              )}
              {webhookInfo?.result?.last_error_message && (
                <p className="text-xs text-destructive mt-2">
                  Error: {webhookInfo.result.last_error_message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Setup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Set the webhook URL to receive messages from Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.vercel.app/api/telegram/webhook"
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-emerald-600">Copied to clipboard!</p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSetWebhook} disabled={loading || !webhookUrl}>
                {loading ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Set Webhook
              </Button>
              {isWebhookActive && (
                <Button variant="outline" onClick={handleDeleteWebhook} disabled={loading}>
                  Remove Webhook
                </Button>
              )}
            </div>

            {status !== "idle" && (
              <Alert variant={status === "success" ? "default" : "destructive"}>
                <AlertDescription className="flex items-center gap-2">
                  {status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Deploy to Vercel</p>
                  <p className="text-sm text-muted-foreground">
                    Make sure your app is deployed and accessible publicly
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Set Webhook</p>
                  <p className="text-sm text-muted-foreground">
                    Click the button above to register your webhook with Telegram
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Start Chatting</p>
                  <p className="text-sm text-muted-foreground">
                    Open your bot in Telegram and ask about your tasks!
                  </p>
                </div>
              </div>
            </div>

            {botInfo?.ok && (
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={`https://t.me/${botInfo.result?.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Bot in Telegram
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Example Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Example Questions</CardTitle>
            <CardDescription>
              Try asking your bot these questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                "What tasks do I have today?",
                "Show upcoming tasks",
                "What&apos;s overdue?",
                "What should I do next?",
                "Show tasks in progress",
                "Find tasks about design",
              ].map((query) => (
                <Badge key={query} variant="secondary" className="cursor-default">
                  {query}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
