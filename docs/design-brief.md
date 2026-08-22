# Design brief & prompts

Prompts for redesigning the app's interface in Claude Design (or any design tool).

**How to use:** paste **§1 (Master brief)** first — it carries the constraints that
apply to every screen. Then paste one screen prompt from §3 per artboard. §2 is for
redoing the visual language itself; run it before the screens if you want a new look,
skip it if you only want the existing look applied more consistently.

---

## 1. Master brief — prepend to every prompt

```
PRODUCT
A personal assistant app. Each user has one assistant they configure (name, look,
voice, language, personality). They chat with it, and it manages their tasks,
reminders and notes, remembers things about them, and messages them proactively.
Single-user-per-account; no social features, no feed, no content library.

PRIMARY USER
One person using it daily on their phone, often one-handed, often in short bursts
(a quick message, ticking off a reminder), sometimes long sessions of conversation.

PLATFORM
Installed PWA, mobile-first. Design mobile (390×844) as the primary artboard and
desktop (1440×900) as a secondary. On desktop there is a persistent left sidebar;
on mobile that sidebar is a slide-in drawer opened from a top bar.

HARD CONSTRAINTS — these are not stylistic choices
- RTL FIRST. The default language is Arabic; the layout mirrors. Never rely on
  left/right positioning that breaks when mirrored. Show every screen in Arabic in
  the mockup, and confirm it also works in English (the UI is bilingual ar/en).
- Arabic typography: the app uses Cairo. Arabic needs more line-height than Latin
  and does not support letter-spacing tricks or all-caps. Avoid condensed type.
- Light AND dark mode. Every colour must be a token that has both values.
- Touch targets ≥ 44px. Primary actions reachable by thumb on a 6.5" phone.
- Safe areas: content must clear the notch and the home indicator.
- No decorative imagery that ships as an asset — the only images are user content
  (the assistant's avatar and photos).

TONE
Calm, warm, personal — closer to a private notebook or a messaging app than to a
dashboard or a SaaS admin panel. It should feel like it belongs to one person.
Avoid: enterprise/analytics look, heavy cards everywhere, loud gradients, emoji as
UI iconography, playful "AI product" clichés (sparkles on every button).

DELIVER
For each screen: the mobile artboard, plus any empty / loading / error state that
screen can be in. Call out spacing, type scale and component reuse explicitly.
```

---

## 2. Visual language (run once, before the screens)

```
Design the visual system for the product described above.

Produce:
1. COLOUR — a token set with light and dark values for: page background, surface,
   elevated surface, overlay, primary text, secondary text, faint text, border,
   strong border, one accent (+ a soft tint of it), and semantic danger / success
   (+ soft tints). Show the palette as swatches with the token name and both values.
   The current app is warm (cream/terracotta) with a green accent; you may keep,
   refine, or replace this — but justify the choice in one line and prove the
   contrast passes WCAG AA for text.
2. TYPE — a scale for Arabic (Cairo) with sizes, weights and line-heights for:
   screen title, section heading, body, secondary, caption. Show a real Arabic
   paragraph at body size, not lorem ipsum.
3. SPACING & RADII — a spacing step scale and the radius values for buttons, inputs,
   cards, sheets and message bubbles.
4. ELEVATION — at most three levels, described as shadow values that also read
   correctly on a dark background.
5. MOTION — durations and easing for: page transition, sheet/drawer open, list item
   enter, toast in/out. Keep it restrained.

Show the tokens applied to a small component sheet: button (primary / outline /
ghost / danger, each in default, pressed, loading, disabled), icon button, text
input, textarea, select, checkbox, chip/tag, card, list row, empty state, toast,
confirm dialog, bottom sheet, avatar (with an online/mood indicator), and a
segmented control. All in Arabic, in both light and dark.
```

---

## 3. Screen prompts

### 3.1 Chat — the main screen (most important)

```
Design the chat screen. This is where the user spends nearly all their time; every
other screen is secondary to it.

STRUCTURE
- Top bar: assistant avatar, assistant name, a one-line status underneath (a short
  mood/state phrase that changes, e.g. "موجودة معاك"), and a menu button that opens
  the navigation drawer.
- Message list, newest at the bottom, auto-scrolling.
- Composer pinned to the bottom.

MESSAGE TYPES — all of these must be designed, they all exist:
1. User text bubble (aligned to the user's side in RTL).
2. Assistant text bubble. A reply may render as several consecutive bubbles.
3. Assistant "typing" indicator while a reply streams in.
4. Image message (1–4 attached images, in a grid).
5. Voice note bubble: play/pause button, progress bar with elapsed/total time, and
   a toggle that reveals the transcript underneath.
6. A message carrying an emoji reaction (a small pill overlapping the bubble edge).
7. A quoted reply: the quoted snippet sits above the new message inside the bubble.
8. A reminder message with a round "mark done" control, in both states.
9. A system "side chat" card: a tappable row inside the main thread that links to a
   separate conversation, with its title.
10. Selection mode: multiple messages selected with checkboxes plus an action bar,
    used to move messages into a side chat.

PER-MESSAGE ACTIONS
On a message: react (emoji picker), reply, delete, and — on the last exchange —
regenerate, and move to a side chat. Design how these appear without cluttering the
thread and without requiring a long-press the user can't discover.

COMPOSER
Text field that grows to a few lines, plus: send, attach image, microphone (record
voice — design idle / recording / transcribing states), and a speaker toggle for
reading replies aloud. Also design the reply-preview strip and the attached-image
preview strip that appear above the field.

STATES
Empty conversation, long conversation with a "load older messages" affordance, a
failed send, and offline.

Two conversation variants to show as a banner treatment: a "side chat" and a
private/incognito chat (the latter must feel visibly different — clearly temporary).
```

### 3.2 Navigation drawer / sidebar

```
Design the navigation. Persistent sidebar on desktop; slide-in drawer on mobile.

CONTENTS
- Assistant identity at the top: avatar, name, and a short current-state line. This
  is tappable and opens the assistant's profile.
- New conversation actions: start a side chat, and start a private/incognito chat.
- The conversation list: main conversation pinned first, then side and private
  chats with their titles, each with a delete affordance.
- Footer links: Journey, Memory, Reminders, Settings, Admin (only for admins),
  Log out.

Show: the drawer open over the chat on mobile (including the scrim and close
affordance), the desktop sidebar, a long conversation list that scrolls, and the
empty state with no side chats yet.
```

### 3.3 Reminders & tasks

```
Design the tasks screen. Today it stacks four different things and reads as a wall
of forms — the redesign's job is to make it scannable and obviously actionable.

CONTENT
1. To-dos: a checkable list, plus a quick-add field. Items can also be created by
   the assistant from conversation.
2. Notes: short saved snippets with a quick-add field.
3. Scheduled tasks & recurring reminders: title, next run time, a recurrence badge
   (daily/weekly), a round complete control, and — for recurring items — a 14-day
   completion strip showing which days were done.
4. One-off reminders and yearly dates (birthdays/anniversaries): title, date, a
   countdown chip ("today" / "tomorrow" / "in 5d"), and a yearly badge.

Sorted soonest-first, with past one-offs de-emphasised at the bottom.

Design the add flow as something better than four separate inline forms — consider
one entry point that adapts to what's being created.

States: everything empty, a busy day with items in every category, and an item
being completed.
```

### 3.4 Memory

```
Design the memory screen — what the assistant remembers about the user, and the
controls to shape it.

CONTENT
1. A teach-it field: type a fact plus pick a type (fact / preference / topic /
   moment / person / feeling), and it's remembered.
2. Filter chips by type, each with a count.
3. The memory list: each entry shows its type, the remembered text, and a remove
   control.
4. A second list: things the assistant has said about itself (its own consistent
   self-facts), each removable.
5. A "forget everything about <topic>" action — destructive, needs confirmation and
   a clear result message.

This screen is about trust and control: the user should feel they can see and edit
everything. Make the destructive action deliberate without making it scary.

States: nothing remembered yet, a long list, and a filter with no matches.
```

### 3.5 Journey / timeline

```
Design the relationship-history screen.

CONTENT
- Header stats: days since the first message, total messages, split by sender.
- A progress meter showing how the relationship has developed, labelled with the
  current stage name (it advances over time: e.g. secretary → friend → close →
  companion). This is the emotional centrepiece of the screen.
- A line chart of the assistant's mood over time (two series: happiness and
  affection). Small, unobtrusive, no chart chrome.
- A photo grid of the assistant's uploaded photos.
- The assistant's nightly diary entries: date, a short mood word, and a paragraph.
- A vertical milestone timeline: first message, message-count milestones,
  anniversaries, first side chat, notable remembered moments.

IMPORTANT: this screen has two personalities depending on how the assistant is
configured — a professional one (work framing, "rapport") and a personal one
(relationship framing, "bond"). Design one layout that carries both by swapping
labels and iconography, not two separate designs.

States: too early (almost no data), and a rich year-old account.
```

### 3.6 Assistant profile

```
Design the assistant's profile screen.

CONTENT
- Large avatar with a change-photo affordance, the assistant's name, and a one-line
  descriptor.
- Its own self-facts (things it has said about itself), as a readable list.
- "How your assistant sees you": an AI-written read on the user — a summary
  paragraph, trait tags, and labelled short sections (communication style,
  interests, values, emotional patterns). This should feel like a considered
  portrait, not a stats card.
- The assistant's photo album: a grid with upload, an optional per-photo tag, and
  delete.
- The user's own notes about themselves: a textarea plus save.

States: brand new (no read yet, no photos), and fully populated.
```

### 3.7 Settings

```
Design the settings screen. It currently sprawls; the redesign should group it so a
non-technical user is never confronted with provider configuration.

GROUPS
1. You: display name, time zone, interface language.
2. Your assistant: name, gender, role (a choice between: starts professional and
   grows closer over time / stays professional / personal from the start), spoken
   language & dialect (8 options), voice (a picker with an audio preview button),
   appearance description, and three personality sliders (playfulness, bluntness,
   warmth).
3. Appearance: light / dark / system.
4. Notifications: permission state, enable, send a test.
5. Install: add to home screen.
6. Advanced — admin only, collapsed by default: AI provider base URL, model names,
   and API keys shown as masked, individually removable cards with an add field.
7. Account: change password, log out.

Design the sliders, the voice picker with preview, and the masked key cards as
first-class components. Show the screen with Advanced collapsed (the normal case)
and expanded.
```

### 3.8 Auth & first run

```
Design three related screens that share one shell:
1. Log in — email, password, link to register, error state.
2. Register — email, password, link to log in, and the state where registration is
   closed.
3. First run — the user has just signed up and names their assistant. A single
   field and one button; everything else is configured later. It should feel like
   the beginning of something, not a form.

The shell has the app icon, a wordmark, a title and a subtitle above a card.
Design it for a first impression on a phone.
```

### 3.9 Admin

```
Design the admin screen (used by one operator, rarely).

CONTENT
- Stat tiles: total users, active today, total messages, total memories.
- User search.
- A user list; each row expands to show: email, locale, time zone, the AI-written
  personality read, the user's own notes, and actions — lock/unlock account, reset
  password, promote/demote admin, delete user.

Keep it plain and dense — this is the one screen where a utilitarian look is right.
Make the destructive actions clearly separated from the routine ones.
```

---

## 4. Cross-cutting prompts

### 4.1 Empty, loading and error states

```
Design the recurring states as a consistent family across the app:
- Loading: skeletons matched to each layout (message list, card list, simple list).
- Empty: icon, one line of what goes here, and the action that fills it. Write the
  copy in Arabic — warm and specific, never "No data".
- Error: a failed request with a retry, and an offline banner.
- Toasts: success, error, and info — including where they sit so they never cover
  the composer.
```

### 4.2 The mood indicator

```
The assistant has a changing internal state (happy, calm, tired, upset, warm,
concerned) shown as a short phrase in the top bar and as a ring/indicator on its
avatar. Design this system: how the state reads at a glance, how it changes without
being distracting, and how the avatar indicator looks at every size (24 / 40 / 80px)
in both themes. It must never look like a "status: online" dot from a chat app.
```

### 4.3 RTL and bilingual verification

```
Take the screens already designed and produce an RTL/LTR verification sheet: the
same three screens (chat, tasks, settings) side by side in Arabic and English.
Flag anything that breaks — icon direction, chevrons, progress direction, number
and date formatting, truncation, and any layout that assumes text width.
```

---

## 5. After the design

Bring back, per screen: the artboard, the token values used, and any new component.
Implementation notes for this codebase:

- Tokens live in `src/app/globals.css` as HSL triples and are consumed through
  Tailwind utility names (`bg-surface`, `text-ink`, `border-border`, …). A palette
  change is a token change, not a component rewrite.
- Shared primitives are in `src/components/ui/` (Button, Card, Input, Avatar,
  IconButton, Toast, Confirm). New components should land there.
- Screens map to `src/app/<route>/page.tsx`; the chat UI is `src/components/ChatWindow.tsx`
  and the shell is `src/components/AppShell.tsx` + `Sidebar.tsx`.
- Keep the message-bubble component cheap to render — it is memoised on purpose
  because the thread re-renders while a reply streams.
