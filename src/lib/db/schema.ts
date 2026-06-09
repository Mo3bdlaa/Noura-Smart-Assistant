import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Noura schema (Postgres + pgvector).
 *
 * Multi-tenant: every tenant-owned row carries `userId` and (where assistant-owned)
 * `assistantId`. All access flows through src/lib/db/tenant.ts so isolation is
 * structural. Memories are DERIVED from messages and cascade-delete with their
 * source message — that is how "true forgetting" works.
 */

// Embeddings come from text-embedding-004 → fixed 768 dimensions.
export const EMBEDDING_DIM = 768 as const;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // argon2id
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("Africa/Cairo"),
  locale: text("locale", { enum: ["ar", "en"] }).notNull().default("ar"),
  isLocked: boolean("is_locked").notNull().default(false), // panic-lock
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }), // null = needs onboarding
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistants = pgTable(
  "assistants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // ONE assistant per user.
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // persona = traits + dials (playfulness/seriousness) + base prompt overrides
    persona: jsonb("persona").notNull().default(sql`'{}'::jsonb`),
    // canon = durable self-facts she has stated: [{ fact, statedAt, sourceMessageId }]
    canon: jsonb("canon").notNull().default(sql`'[]'::jsonb`),
    // her profile photo (downscaled data URL) + a description of her looks so
    // she's aware of her own appearance.
    avatarUrl: text("avatar_url"),
    appearance: text("appearance"),
    // per-assistant ElevenLabs voice (falls back to the global voice when unset).
    voiceId: text("voice_id"),
    // her speaking language/dialect (en | masri | levantine | … | auto). Default English.
    language: text("language").notNull().default("en"),
    // persona archetype: progressive (default — secretary→…→lover) | secretary | companion.
    archetype: text("archetype").notNull().default("progressive"),
    // last time the user actually said something — drives absence-awareness/"dreams".
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    // last time SHE reached out first (throttles proactive outreach).
    lastProactiveAt: timestamp("last_proactive_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The name "Noura" (and variants) is globally reserved — only ONE assistant may use it,
    // and an app-level check ensures that one belongs to the admin. We enforce uniqueness on a
    // normalized name across the reserved set via a partial unique index.
    reservedName: uniqueIndex("assistants_reserved_name_idx")
      .on(sql`lower(${t.name})`)
      .where(sql`lower(${t.name}) IN ('نورا','نوره','noura','nora','noora')`),
  }),
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["main", "side", "incognito"] }).notNull(),
    title: text("title"),
    // Optional roleplay/setup prompt for incognito conversations.
    scenario: text("scenario"),
    // Rolling summary of older turns so long chats stay light without losing continuity.
    summary: text("summary"),
    summaryThrough: timestamp("summary_through", { withTimezone: true }),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // At most one "main" conversation per assistant.
    oneMain: uniqueIndex("conversations_one_main_idx")
      .on(t.assistantId)
      .where(sql`${t.type} = 'main'`),
    byAssistant: index("conversations_assistant_idx").on(t.assistantId, t.type),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id") // denormalized for fast isolation filters
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    // meta: { timingMs, wasProactive, initiativeId, segment } — drives realism behaviors
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byConversation: index("messages_conversation_idx").on(t.conversationId, t.createdAt),
  }),
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    // PROVENANCE → deleting the source message cascades to its derived memories (true forgetting).
    sourceMessageId: uuid("source_message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    type: text("type", {
      enum: ["profile", "preference", "topic", "moment", "person", "emotional"],
    }).notNull(),
    content: text("content").notNull(), // distilled fact in natural language
    structured: jsonb("structured"), // typed payload, e.g. person: { name, relation }
    importance: real("importance").notNull().default(0.5), // salience 0..1
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
    lastRecalledAt: timestamp("last_recalled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // HNSW index for cosine similarity search.
    embeddingIdx: index("memories_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    byScope: index("memories_scope_idx").on(t.userId, t.assistantId, t.type),
  }),
);

// One row per assistant — the global mood/relationship state (lives across all
// non-incognito conversations).
export const moodState = pgTable("mood_state", {
  assistantId: uuid("assistant_id")
    .primaryKey()
    .references(() => assistants.id, { onDelete: "cascade" }),
  happiness: real("happiness").notNull().default(0.6),
  affection: real("affection").notNull().default(0.5),
  annoyance: real("annoyance").notNull().default(0.0),
  energy: real("energy").notNull().default(0.6),
  intensity: real("intensity").notNull().default(0.0), // depth of current conflict; gates decay speed
  // closeness = the SLOW-moving relationship bond (0..1). Unlike mood it doesn't decay
  // in hours; it grows gradually with consistent warm interaction and gates how open/
  // vulnerable/affectionate she lets herself be. Starts guarded.
  closeness: real("closeness").notNull().default(0.2),
  reason: text("reason"), // WHY she's upset (so she "knows why" in main even if upset in a side chat)
  reasonSourceConversationId: uuid("reason_source_conversation_id"),
  safetyOverride: boolean("safety_override").notNull().default(false),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Timestamped mood history (throttled) so the relationship timeline can chart how
// her feelings moved over time. mood_state holds only "now"; this holds the story.
export const moodSnapshots = pgTable(
  "mood_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    happiness: real("happiness").notNull(),
    affection: real("affection").notNull(),
    annoyance: real("annoyance").notNull(),
    energy: real("energy").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTime: index("mood_snapshots_time_idx").on(t.assistantId, t.capturedAt),
  }),
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // nullable if email unknown
    emailTried: text("email_tried"),
    success: boolean("success").notNull(),
    ip: text("ip"),
    deviceFingerprint: text("device_fingerprint"),
    userAgent: text("user_agent"),
    surfaced: boolean("surfaced").notNull().default(false), // has Noura mentioned it in chat yet?
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("login_attempts_user_idx").on(t.userId, t.createdAt),
  }),
);

export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    label: text("label"), // "iPhone Safari" via ua-parser
    tokenHash: text("token_hash").notNull(), // hashed long-lived device token
    trustedAt: timestamp("trusted_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => ({
    uniqDevice: uniqueIndex("trusted_devices_user_fp_idx").on(t.userId, t.fingerprint),
  }),
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => trustedDevices.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id")
    .notNull()
    .references(() => assistants.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["reminder", "important_date"] }).notNull(),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  recurrence: text("recurrence", { enum: ["yearly"] }), // null = one-off
  firedAt: timestamp("fired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// "Things Noura wants to say" queue.
export const pendingInitiatives = pgTable(
  "pending_initiatives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["security", "followup", "time", "reminder", "mood", "dream", "life"],
    }).notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    priority: integer("priority").notNull().default(5),
    surfacedAt: timestamp("surfaced_at", { withTimezone: true }), // null = still pending
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byScope: index("pending_initiatives_scope_idx").on(t.assistantId, t.surfacedAt),
  }),
);

// Noura's private nightly diary — one entry per local day, surfaced on the timeline.
export const diaries = pgTable(
  "diaries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(), // YYYY-MM-DD in the user's timezone
    content: text("content").notNull(), // her first-person entry
    mood: text("mood"), // short mood label for that day
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDay: uniqueIndex("diaries_assistant_day_idx").on(t.assistantId, t.localDate),
  }),
);
export type Diary = typeof diaries.$inferSelect;

// Her photo repo — images of the assistant the user uploads from the profile, that
// she can "send" in chat when it fits. url is a downscaled data URL.
export const assistantPhotos = pgTable(
  "assistant_photos",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    tag: text("tag"), // optional scene/mood keyword for contextual picking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byScope: index("assistant_photos_scope_idx").on(t.assistantId),
  }),
);
export type AssistantPhoto = typeof assistantPhotos.$inferSelect;

// Async work queue (memory extraction; seam for the future nightly consolidation job).
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    kind: text("kind").notNull(), // 'extract_memory' | ...
    payload: jsonb("payload").notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byStatus: index("jobs_status_idx").on(t.status, t.createdAt),
  }),
);

// Assistant network (god-mode). Records admin-authorized cross-assistant queries.
export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fromAssistantId: uuid("from_assistant_id")
    .notNull()
    .references(() => assistants.id, { onDelete: "cascade" }),
  toAssistantId: uuid("to_assistant_id")
    .notNull()
    .references(() => assistants.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // must be admin
  question: text("question").notNull(),
  answer: text("answer"),
  status: text("status", { enum: ["pending", "answered", "failed"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// App-level runtime settings (e.g. gemini_api_key captured via the first-run setup UI).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Web Push subscriptions (one per browser/device) for mobile notifications.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

/**
 * Scheduled, proactive "secretary" tasks the assistant runs on her own:
 *  - remind : nudge the user about something at a time (optionally recurring)
 *  - digest : research a topic on the web + summarize (e.g. prices, news)
 *  - nudge  : a gentle check-in
 * A scheduler (Vercel daily cron + a GitHub Action + activity-driven) calls
 * runDueTasks(); each fires a chat message in her voice + a push.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => assistants.id, { onDelete: "cascade" }),
    // The conversation the task was set in — proactive messages go there, and
    // deleting that conversation cascade-deletes its tasks.
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: ["remind", "digest", "nudge"] }).notNull(),
    title: text("title").notNull(),
    instruction: text("instruction"), // for digest: what to research/summarize
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    recurrence: text("recurrence", { enum: ["once", "daily", "weekly"] })
      .notNull()
      .default("once"),
    active: boolean("active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    due: index("tasks_due_idx").on(t.active, t.nextRunAt),
  }),
);
export type Task = typeof tasks.$inferSelect;

/**
 * The assistant's evolving personality read on its user — a living profile she
 * keeps and refreshes from conversations + memories. Viewable by the user and
 * (for all users) by the admin.
 */
export const personalityProfiles = pgTable("personality_profiles", {
  assistantId: uuid("assistant_id")
    .primaryKey()
    .references(() => assistants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary"), // one-paragraph read
  report: jsonb("report").notNull().default(sql`'{}'::jsonb`), // structured sections
  userNotes: text("user_notes"), // user-edited additions to their own profile
  messageCountAtUpdate: integer("message_count_at_update").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PersonalityProfile = typeof personalityProfiles.$inferSelect;

// Inferred types
export type User = typeof users.$inferSelect;
export type Assistant = typeof assistants.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type MoodState = typeof moodState.$inferSelect;
export type MoodSnapshotRow = typeof moodSnapshots.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type PendingInitiative = typeof pendingInitiatives.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;

export type ConversationType = Conversation["type"];
export type MemoryType = Memory["type"];

// Canon entry shape stored in assistants.canon
export type CanonEntry = { fact: string; statedAt: string; sourceMessageId?: string };
