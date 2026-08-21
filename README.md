# Noura

A self-hosted **personal assistant platform**. Each user gets their own assistant with
persistent memory, scheduled reminders, a task/note workspace, and two-way voice — served
as an installable PWA and designed to run entirely on free provider tiers.

---

## Features

**Assistant**
- Per-user assistant, configured from the app: display name, response language/dialect,
  voice, and tone parameters.
- Multi-language output (English, Modern Standard Arabic, several regional dialects,
  French, or automatic mirroring of the user's language).
- Configurable behaviour profile — assistants are defined by data, not hardcoded.

**Memory**
- Vector-backed long-term memory (pgvector) with semantic retrieval per turn.
- Rolling conversation summarisation so long threads keep context without unbounded prompts.
- A memory management page: browse, add, and delete entries, or forget an entire topic.
- Private/incognito conversations that neither write to nor read from stored memory.

**Tasks and reminders**
- Natural-language scheduling — "remind me every day at 9" creates a recurring task.
- One-off and recurring (daily/weekly) tasks with per-occurrence completion tracking
  and a 14-day completion strip.
- Complete a task from the reminder message itself, from the task list, or by telling
  the assistant it's done.
- To-do and note capture during conversation, plus a daily briefing of open items.

**Voice and images**
- Text-to-speech with a server-side audio cache (each line is synthesised once).
- Speech-to-text for voice input, transcribed server-side so it works on iOS PWAs.
- Image attachments, an uploadable image library, and optional generated images.

**Platform**
- Installable PWA with Web Push notifications.
- Multi-tenant: per-user data isolation, invite-only registration, admin panel for
  user administration.
- Provider key pools with automatic rotation and cool-down on quota errors.
- Per-user rate limiting on model-backed endpoints.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, React, TypeScript) |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon) + pgvector, via Drizzle ORM |
| Models | Google Gemini — chat, embeddings, TTS, STT (provider-agnostic client) |
| Auth | Argon2id password hashing, sealed session cookies |
| Scheduling | Vercel Cron + activity-triggered execution |
| Hosting | Vercel |

---

## Getting started

### Requirements
- Node.js 20+
- A PostgreSQL database with the `vector` extension (Neon works out of the box)
- A Google Gemini API key

### Install

```bash
git clone https://github.com/Mo3bdlaa/Noura-Smart-Assistant.git
cd Noura-Smart-Assistant
npm install
```

### Configure

Create `.env.local`:

```bash
# required
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SESSION_SECRET=          # 32+ random characters
GEMINI_API_KEY=

# optional
REGISTRATION_OPEN=false  # "true" opens public sign-up
CRON_SECRET=             # if set, /api/cron/tick requires it
VAPID_PUBLIC_KEY=        # web push (npx web-push generate-vapid-keys)
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
POLLINATIONS_TOKEN=      # image generation
```

Additional model keys and endpoints can be managed at runtime from the admin settings
page instead of environment variables.

### Run

```bash
npm run db:push   # apply the schema
npm run dev       # http://localhost:3000
```

First launch redirects to `/setup` to create the admin account and the initial assistant.

---

## Architecture

```
src/
├── app/
│   ├── api/            # route handlers (chat, tasks, memory, voice, admin, cron)
│   ├── chat/           # conversation UI
│   ├── memories/       # memory management
│   ├── reminders/      # tasks, to-dos, notes
│   ├── settings/       # assistant + provider configuration
│   └── admin/          # user administration
├── components/         # React components
└── lib/
    ├── db/             # Drizzle schema + client
    ├── llm/            # provider client, key pool, embeddings
    ├── memory/         # extraction, retrieval, summarisation
    ├── persona/        # prompt assembly
    ├── tasks/          # detection, scheduling, execution
    ├── secretary/      # to-dos and notes
    ├── voice/          # TTS/STT and voice configuration
    └── proactive/      # scheduled message delivery
```

**Request flow.** A chat turn assembles a system prompt from the assistant's
configuration, retrieved memories, the rolling summary, and open tasks; streams the
model response; and afterwards runs memory extraction, task detection, and
summarisation outside the response path.

**Scheduling.** `/api/cron/tick` executes due tasks and delivers scheduled messages.
Task execution also runs on user activity, so reminders still fire between cron
invocations.

**Key pools.** Provider keys are stored as a pool; the client rotates across them and
cools down any key that returns a quota or rate-limit error, so several free-tier keys
can back a single deployment.

---

## Deployment

Deploys to Vercel as a standard Next.js app. Set the environment variables above and
apply the schema with `npm run db:push`.

**Scheduler resolution.** `vercel.json` registers two daily cron invocations, which is
the Hobby plan ceiling. Time-of-day accuracy therefore depends on either a paid plan
(sub-daily cron) or an external scheduler calling the tick endpoint:

```
GET https://<deployment>/api/cron/tick?key=$CRON_SECRET
```

Any interval-capable scheduler works (for example a 15-minute job). Without one,
scheduled messages are delivered on the next cron invocation or the next time the user
is active, and the message notes how late it is.

---

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
npm run db:push      # push schema changes
npm run db:generate  # generate migrations
npm run db:seed      # seed data
npm test             # vitest
```

---

## Testing

Unit tests cover the pure logic most prone to regression: control-tag sanitisation,
streaming lead-tag parsing, relationship-stage mapping, persona core selection,
image-prompt/seed determinism, voice defaults, and rate limiting.

```bash
npm test
```

CI (`.github/workflows/ci.yml`) runs `tsc --noEmit` and the test suite on every push.

---

## Status

Actively developed; interfaces and schema may change between commits.

## License

Not currently licensed for redistribution.
