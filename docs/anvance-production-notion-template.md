# Anvance Production — Notion workspace template

Use this as your **single source of truth** for social marketing, photo/video, social management, ads, and strategy. One row = **one actionable outcome**. **Every task has exactly one primary assignee** (see below for collaborators).

---

## 1. Core principle: assignment

- **Primary assignee (required):** one person owns delivery and updates status.
- **Collaborators (optional):** additional people property for “helping / CC’d” (not ownership).
- **Reviewer (optional but recommended):** strategist or lead for client-facing sign-off.

If you only add one people column, name it **Assignee** and enforce “one person only” in team rules.

---

## 2. Database: `Production` (main task board)

Create a new database **inline** on a page called **Anvance Production — Hub** (or full-page database).

### Properties (create in this order)

| # | Property name | Type | Purpose |
|---|---------------|------|---------|
| 1 | **Name** | Title | Short outcome title (see naming below) |
| 2 | **Client** | Select (or Relation → Clients DB) | Who the work is for |
| 3 | **Service line** | Select | Photo / Video / Social / Ads / Strategy |
| 4 | **Deliverable** | Select | What “done” looks like |
| 5 | **Status** | Select | Pipeline stage |
| 6 | **Priority** | Select | Urgency |
| 7 | **Assignee** | People | **Single owner** (turn off “Allow multiple people” if you want strict one-owner) |
| 8 | **Collaborators** | People | Optional; allow multiple |
| 9 | **Reviewer** | People | Who signs off before client |
| 10 | **Due date** | Date | Internal deadline |
| 11 | **Shoot / live date** | Date | On-site or go-live |
| 12 | **Channels** | Multi-select | IG, TikTok, Meta, LinkedIn, YouTube, Other |
| 13 | **Brief link** | URL | Notion brief, Google Doc, etc. |
| 14 | **Assets link** | URL | Drive, Frame.io, Dropbox |
| 15 | **Internal notes** | Text | Handoffs, blockers, context |
| 16 | **Est. hours** | Number | Capacity (optional) |
| 17 | **Blocked by** | Text | Short blocker description |
| 18 | **Client approval** | Select | Tracks external approval |
| 19 | **Campaign** | Text or Relation | Campaign or package name |
| 20 | **Created time** | Created time | Auto |
| 21 | **Last edited time** | Last edited time | Auto |

### Select options (copy exactly)

**Service line**

- Photo  
- Video  
- Social  
- Ads  
- Strategy  

**Deliverable** (edit anytime)

- Shoot day  
- Photo deliverable pack  
- Video edit / long-form  
- Reels / short-form pack  
- Social calendar & posts  
- Community / engagement  
- Ads campaign setup  
- Ads creative refresh  
- Reporting & insights  
- Strategy deck / retainer doc  
- Other  

**Status** (full pipeline — hide columns you don’t need)

- Intake  
- Briefing  
- Scheduled  
- In production  
- Internal review  
- Client review  
- Revisions  
- Approved  
- Published  
- Reporting  
- Done  
- On hold  

**Priority**

- P0 — Today / launch  
- P1 — This week  
- P2 — Next week  
- P3 — Backlog  

**Client approval**

- Not sent  
- Sent  
- Changes requested  
- Approved  

### Naming convention (Name / title)

`[Client] — [Deliverable] — [Due YYYY-MM-DD or Week]`

Examples:

- `Acme — Reels pack (5x) — Due 2026-04-22`  
- `Bloom — Shoot day — 2026-04-20`  
- `North — Meta ads refresh — W16`  

---

## 3. Views to create (team + speed)

Create these **linked views** of `Production` on your Hub page.

| View name | Layout | Filter / sort |
|-----------|--------|----------------|
| **Today** | Table or Board | Due date = Today OR Shoot/live = Today; Status ≠ Done, On hold |
| **My work** | Board by Status | Assignee = Me; Status ≠ Done |
| **Team queue** | Table | Status = Intake OR Briefing; sort Priority then Due date |
| **In production** | Board by Assignee | Status = In production |
| **Needs review** | Table | Status = Internal review OR Client review |
| **Blocked** | Table | Blocked by is not empty OR Status = On hold |
| **Overdue** | Table | Due date < Today; Status ≠ Done |
| **This week** | Table | Due date on or after start of week and on or before end of week |
| **By client** | Board | Group by Client |
| **Done (last 14 days)** | Table | Status = Done; Last edited in last 14 days |

---

## 4. Optional second database: `Clients`

Minimal columns:

- **Name** (title) — client or brand  
- **Primary contact** — text or email  
- **Contract / notes** — text  
- **Link to Production** — linked view or relation from Production → Client  

Link **Production.Client** as a **relation** to `Clients` when you outgrow Select.

---

## 5. Weekly rhythm (no fixed volume needed)

1. **Intake:** new rows start as **Intake** with Client + Name + Assignee + Due date.  
2. **Briefing:** strategist fills Brief link + Deliverable + Reviewer.  
3. **Production:** assignee moves to **In production**; updates Internal notes.  
4. **Review:** **Internal review** → **Client review** only when Reviewer agrees.  
5. **Ship:** **Approved** → **Published** → **Reporting** → **Done**.

**Telegram bot:** use for “what’s today / overdue / in progress” — Notion stays the record.

---

## 6. Connect your existing bot (Telegram ↔ Notion)

1. In Notion: open **Production** → **Share** → **Connections** → add your integration (e.g. TaskBot).  
2. In Vercel (or `.env.local`): set at minimum:
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID` (from the database URL)
   - `NOTION_STATUS_FILTER_TYPE=select` (this template uses **Select** for Status)

### Property names (defaults match this template)

The bot reads these **exact** property names unless you override with env:

| Notion property | Env variable | Default |
|-----------------|--------------|---------|
| Title | `NOTION_TASK_NAME_PROPERTY` | `Name` |
| Due date | `NOTION_DUE_DATE_PROPERTY` | `Due date` (default matches Notion CSV export / template; use `Due Date` only if your column is spelled that way) |
| Shoot / live date | `NOTION_SHOOT_LIVE_DATE_PROPERTY` | Default `Shoot / live date` (matches your CSV). Set `-` or `none` in env if your database has no such column. |
| Status | `NOTION_STATUS_PROPERTY` | `Status` |
| Assignee | `NOTION_ASSIGNEE_PROPERTY` | `Assignee` |
| Collaborators | `NOTION_COLLABORATORS_PROPERTY` | `Collaborators` |
| Reviewer | `NOTION_REVIEWER_PROPERTY` | `Reviewer` |
| Client | `NOTION_CLIENT_PROPERTY` | `Client` |
| Service line | `NOTION_SERVICE_LINE_PROPERTY` | `Service line` |
| Deliverable | `NOTION_DELIVERABLE_PROPERTY` | `Deliverable` |
| Priority | `NOTION_PRIORITY_PROPERTY` | `Priority` |
| Channels | `NOTION_CHANNELS_PROPERTY` | `Channels` |
| Brief link | `NOTION_BRIEF_LINK_PROPERTY` | `Brief link` |
| Assets link | `NOTION_ASSETS_LINK_PROPERTY` | `Assets link` |
| Internal notes | `NOTION_INTERNAL_NOTES_PROPERTY` | `Internal notes` |
| Blocked by | `NOTION_BLOCKED_BY_PROPERTY` | `Blocked by` |
| Client approval | `NOTION_CLIENT_APPROVAL_PROPERTY` | `Client approval` |
| Campaign | `NOTION_CAMPAIGN_PROPERTY` | `Campaign` |

### Status labels (must match Notion options)

- **In production** — used for the “In production” quick button (`NOTION_STATUS_IN_PROGRESS`, default `In production`).  
- **Done** / **On hold** — excluded from “active” lists (`NOTION_STATUS_DONE`, `NOTION_STATUS_ON_HOLD`).  
- **Team queue** — comma list in `NOTION_PIPELINE_QUEUE_STATUSES` (default `Intake,Briefing,Scheduled`).  
- **Needs review** — `NOTION_REVIEW_STATUSES` (default `Internal review,Client review`).

If your Notion options use different spelling (e.g. “Internal Review”), either fix Notion or set the matching env values.

### Telegram quick buttons (after deploy)

Today · Upcoming · Overdue · In production · What next · **Team queue** · **Needs review** · **Blocked** — plus `/menu`, `/debug`, and natural-language questions via the AI path.

---

## 6b. Assignment pings (Notion → Telegram)

When someone is set on **Assignee** in Production, the app can **DM** them on Telegram (and optionally post to a **team group**).

### 1) Notion → your app

1. In Notion: **Settings → Integrations → your integration → Webhooks** (or the Webhooks tab for your internal integration).
2. Add endpoint: `https://<your-vercel-domain>/api/notion/webhook`
3. Subscribe to at least:
   - `page.created` (new row with assignee)
   - `page.properties_updated` (assignee changed — batched by Notion; [event docs](https://developers.notion.com/reference/webhooks-events-delivery))

Complete verification if Notion asks for a challenge.

### 2) Map Notion people → Telegram

Set **`TELEGRAM_NOTION_USER_MAP`** in Vercel (JSON array). Each person who should get DMs needs one row.

```json
[
  { "notionUserId": "17ed872b-594c-8192-b233-000238bdfc6a", "telegramChatId": "123456789" }
]
```

- **`notionUserId`**: Notion workspace member UUID (same format as in People on a page — you can copy from a Notion profile URL or from the API).
- **`telegramChatId`**: Telegram numeric ID for **private chat** with the bot (users can message [@userinfobot](https://t.me/userinfobot) to learn their id). The user must **/start** your bot once so DMs are allowed.

### 3) Optional: team channel

- **`TELEGRAM_ASSIGNMENT_GROUP_ID`**: id of a group/supergroup (e.g. `-100…`) where short “someone was assigned” lines are posted.
- **`TELEGRAM_ASSIGNMENT_NOTIFY_MODE`**: `dm` (default) | `group` | `both`.

### 4) Toggles & env

| Variable | Purpose |
|----------|---------|
| `NOTIF_ASSIGNMENT_ENABLED` | `false` to turn off all assignment notifications. Default: on if map or group id is set. |
| `NOTION_WEBHOOK_DEBUG` | Set `true` to log event type + entity id (not full payload). |

Same **`NOTION_API_KEY`**, **`NOTION_DATABASE_ID`**, and property names as the bot (`Assignee`, `Name`, `Due date`, etc.) are used when reading the page after each event.

### UX behaviour

- **`page.properties_updated`**: only runs the assignee flow if Notion reports that the **Assignee** column was among the updated properties (reduces noise when editing notes or dates).
- **`page.created`**: notifies if the new row has assignees and they are in the map.
- Messages are **plain text** (no Markdown) so client names and titles do not break Telegram.
- Each mapped assignee gets a short DM with task title, client, status, due date, and a **Open in Notion** link.

### Reference: Production CSV export (column headers)

If you export **Production → All → Export → CSV**, the header row should match what the bot expects. Verified example:

`Name`, `Assets link`, `Assignee`, `Blocked by`, `Brief link`, `Campaign`, `Channels`, `Client`, `Client approval`, `Collaborators`, `Created time`, `Deliverable`, **`Due date`**, `Est. hours`, `Internal notes`, `Last edited time`, `Priority`, `Reviewer`, `Service line`, **`Shoot / live date`**, `Status`

The bot defaults **`Due date`** and **`Shoot / live date`** to these spellings. If your export differs, set the matching `NOTION_*` env vars in Vercel.

---

## 7. Import CSV (optional)

See `docs/anvance-production-sample-tasks.csv`. Import into a **new** Notion database from `⋯ → Merge with CSV` or create database → Import, then adjust property types to match section 2.

---

## Quick checklist

- [ ] Hub page created  
- [ ] `Production` database with all properties  
- [ ] Status + Priority + Client approval options added  
- [ ] Assignee = single owner; Collaborators optional  
- [ ] 8–10 views created  
- [ ] Integration connected to database  
- [ ] Team trained on naming + status rules  

**Anvance Production** — Notion for depth, Telegram for speed.
