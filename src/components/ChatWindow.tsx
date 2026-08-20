"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Circle,
  GitBranch,
  Glasses,
  ImagePlus,
  MessageCircleHeart,
  Mic,
  Pencil,
  Reply,
  RotateCcw,
  SendHorizontal,
  SmilePlus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { useI18n } from "@/components/i18n";
import { Markdown } from "@/components/Markdown";
import { VoiceNote } from "@/components/VoiceNote";
import { cn } from "@/lib/cn";

type ReplyRef = { id: string; role: "user" | "assistant"; preview: string };

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  reaction?: string | null;
  /** render this (assistant) message as a voice note */
  voice?: boolean;
  /** if this is a reminder message, the task it can mark done */
  taskId?: string;
  /** local: the reminder was checked off */
  taskDone?: boolean;
  /** quoted message this one is replying to */
  replyTo?: ReplyRef | null;
  /** if set, this row is a card linking to a side conversation */
  sideCardId?: string;
};

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥", "🥰"];

/** Downscale an image file to a small JPEG data URL (keeps the request small). */
function fileToDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}
type Props = {
  conversationId: string;
  conversationType: "main" | "side" | "incognito";
  scenario?: string | null;
  assistantName: string;
  assistantPhoto?: string | null;
  assistantMood: "happy" | "calm" | "upset";
  initialMessages: Msg[];
};

const TYPE_BANNER: Record<
  Props["conversationType"],
  { icon: React.ReactNode; text: string } | null
> = {
  main: null,
  side: {
    icon: <MessageCircleHeart className="size-3.5" />,
    text: "محادثة جانبية — بتتسجّل في ذاكرتها العامة.",
  },
  incognito: {
    icon: <Glasses className="size-3.5" />,
    text: "وضع تخيّلي — اللي هنا مش هتفتكره بعد ما تمسحه.",
  },
};

export function ChatWindow({
  conversationId,
  conversationType,
  scenario,
  assistantName,
  assistantPhoto,
  assistantMood,
  initialMessages,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
  const [scen, setScen] = useState(scenario ?? "");
  const [scenOpen, setScenOpen] = useState(false);
  const [scenSaving, setScenSaving] = useState(false);

  async function saveScenario() {
    setScenSaving(true);
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scen.trim() }),
      });
      setScenOpen(false);
      router.refresh();
    } finally {
      setScenSaving(false);
    }
  }
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImages(files: FileList | null) {
    if (!files?.length) return;
    const picked = await Promise.all(
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 4)
        .map((f) => fileToDataUrl(f).catch(() => null)),
    );
    setImages((prev) => [...prev, ...picked.filter((x): x is string => !!x)].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  }

  // --- voice: dictation (STT) + read-aloud (TTS), both free & browser-native ---
  const [ttsOn, setTtsOn] = useState(false);
  const [listening, setListening] = useState(false); // recording
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setTtsOn(localStorage.getItem("noura_tts") === "1");
  }, []);

  function browserSpeak(clean: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "ar-EG";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function speak(text: string) {
    if (!ttsOn || typeof window === "undefined") return;
    const clean = text.replace(/[*_#`>~]/g, "").trim();
    if (!clean) return;
    // Prefer her real voice (ElevenLabs); fall back to the browser voice if it's
    // not configured or the request fails.
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        const url = URL.createObjectURL(await res.blob());
        window.speechSynthesis?.cancel();
        audioRef.current?.pause();
        const a = new Audio(url);
        audioRef.current = a;
        a.onended = () => URL.revokeObjectURL(url);
        await a.play();
        return;
      }
    } catch {
      /* fall through to browser TTS */
    }
    browserSpeak(clean);
  }

  function toggleTts() {
    setTtsOn((v) => {
      const nv = !v;
      localStorage.setItem("noura_tts", nv ? "1" : "0");
      if (!nv) {
        window.speechSynthesis?.cancel();
        audioRef.current?.pause();
      }
      return nv;
    });
  }

  // Encode an AudioBuffer to a 16kHz mono 16-bit WAV (a format Gemini STT accepts).
  function encodeWav(buffer: AudioBuffer): Blob {
    const targetRate = 16000;
    const src = buffer.getChannelData(0);
    const ratio = buffer.sampleRate / targetRate;
    const outLen = Math.floor(src.length / ratio);
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const s = Math.max(-1, Math.min(1, src[Math.floor(i * ratio)] ?? 0));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const wav = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); wav.setUint32(4, 36 + pcm.length * 2, true); wr(8, "WAVE"); wr(12, "fmt ");
    wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
    wav.setUint32(24, targetRate, true); wav.setUint32(28, targetRate * 2, true);
    wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); wr(36, "data");
    wav.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) wav.setInt16(44 + i * 2, pcm[i], true);
    return new Blob([wav.buffer], { type: "audio/wav" });
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf);
      ctx.close();
      const wav = encodeWav(decoded);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(await wav.arrayBuffer())));
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mimeType: "audio/wav" }),
      });
      const data = await res.json().catch(() => ({}));
      const text = (data.text ?? "").trim();
      if (text) {
        setInput((prev) => (prev ? prev + " " : "") + text);
        taRef.current?.focus();
      } else {
        toast(t("ماسمعتش كلام واضح", "Didn't catch that"), "error");
      }
    } catch {
      toast(t("مش قادرة أحوّل الصوت", "Couldn't transcribe"), "error");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleMic() {
    if (listening) {
      mediaRecRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast(t("الجهاز ده مش بيدعم التسجيل", "Recording not supported here"), "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      audioChunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.onstop = () => {
        micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
        micStreamRef.current = null;
        setListening(false);
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) transcribe(blob);
      };
      mediaRecRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      toast(t("لازم تسمح بالمايك", "Mic permission needed"), "error");
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId, initialMessages]);

  // Reflect the real done-state on reminder checkboxes: a task that's completed
  // today, finished, or gone shows as done instead of resetting to unchecked.
  useEffect(() => {
    if (!initialMessages.some((m) => m.taskId)) return;
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        const alive = new Map(
          ((d.tasks ?? []) as { id: string; completedToday?: boolean }[]).map((t) => [t.id, t]),
        );
        setMessages((ms) =>
          ms.map((x) => {
            if (!x.taskId) return x;
            const t = alive.get(x.taskId);
            return { ...x, taskDone: !t || !!t.completedToday };
          }),
        );
      })
      .catch(() => {});
  }, [conversationId, initialMessages]);

  // auto-grow the textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    const imgs = images;
    if ((!text && imgs.length === 0) || streaming) return;
    setInput("");
    setImages([]);
    const replyTo: ReplyRef | null = replyingTo
      ? { id: replyingTo.id, role: replyingTo.role, preview: replyingTo.content.slice(0, 160) }
      : null;
    const replyToId = replyingTo && !replyingTo.id.startsWith("tmp-") && !replyingTo.id.startsWith("draft-")
      ? replyingTo.id
      : undefined;
    setReplyingTo(null);
    const userMsg: Msg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      images: imgs.length ? imgs : undefined,
      replyTo,
    };
    const draftId = `draft-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: draftId, role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, images: imgs, replyToId }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? t("حصل خطأ، جرّب تاني", "Something went wrong, try again"));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = ""; // visible reply text (control frame stripped)
      let raw = "";
      let controlDone = false;
      let draftHasPhoto = false;
      let draftIsVoice = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!controlDone) {
          raw += chunk;
          if (raw.startsWith(" ")) {
            const nl = raw.indexOf("\n");
            if (nl === -1) continue; // wait for the full control line
            try {
              const ctrl = JSON.parse(raw.slice(1, nl));
              if (ctrl.reaction) {
                const rid = userMsg.id;
                setMessages((m) => m.map((x) => (x.id === rid ? { ...x, reaction: ctrl.reaction } : x)));
              }
              if (ctrl.replyTo) {
                setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, replyTo: ctrl.replyTo } : x)));
              }
              if (ctrl.photo) {
                draftHasPhoto = true;
                setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, images: [ctrl.photo] } : x)));
              }
              if (ctrl.voice) {
                draftIsVoice = true;
                setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, voice: true } : x)));
              }
            } catch {
              /* ignore malformed control frame */
            }
            acc = raw.slice(nl + 1);
            controlDone = true;
          } else {
            controlDone = true; // no control frame
            acc = raw;
          }
        } else {
          acc += chunk;
        }
        // Safety net: the model may leak a stray <voice>/</voice> — strip it from the
        // shown text and treat it as a voice note even if it arrived late.
        if (!draftIsVoice && /<\s*\/?\s*voice\s*\/?\s*>/i.test(acc)) draftIsVoice = true;
        const display = acc.replace(/<\s*\/?\s*voice\s*\/?\s*>/gi, "");
        setMessages((m) =>
          m.map((x) => (x.id === draftId ? { ...x, content: display, voice: x.voice || draftIsVoice } : x)),
        );
      }
      const finalText = acc.replace(/<\s*\/?\s*voice\s*\/?\s*>/gi, "").trim();
      // React-only turn (just an emoji, no words, no photo) → drop the empty bubble.
      if (finalText === "" && !draftHasPhoto) {
        setMessages((m) => m.filter((x) => x.id !== draftId));
      } else if (finalText && !draftIsVoice) {
        speak(finalText); // voice notes have their own player
      }
      router.refresh();
    } catch (e) {
      setMessages((m) =>
        m.map((x) => (x.id === draftId ? { ...x, content: `⚠️ ${(e as Error).message}` } : x)),
      );
    } finally {
      setStreaming(false);
    }
  }

  async function react(id: string, emoji: string) {
    if (id.startsWith("tmp-") || id.startsWith("draft-")) return;
    let next: string | null = emoji;
    setMessages((m) =>
      m.map((x) => {
        if (x.id !== id) return x;
        next = x.reaction === emoji ? null : emoji; // toggle off if same
        return { ...x, reaction: next };
      }),
    );
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: next }),
    });
  }

  async function regenerate() {
    if (streaming || !messages.some((m) => m.role === "user")) return;
    // Stream into the trailing assistant reply if there is one; otherwise add a
    // fresh assistant bubble (e.g. when the previous reply errored/empty).
    let targetIdx = messages.length - 1;
    if (messages[targetIdx]?.role === "assistant" && !messages[targetIdx]?.sideCardId) {
      setMessages((m) => m.map((x, i) => (i === targetIdx ? { ...x, content: "" } : x)));
    } else {
      targetIdx = messages.length;
      setMessages((m) => [...m, { id: `draft-${Date.now()}`, role: "assistant", content: "" }]);
    }
    setStreaming(true);
    try {
      const res = await fetch("/api/chat/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok || !res.body) throw new Error("regen failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x, i) => (i === targetIdx ? { ...x, content: acc } : x)));
      }
      if (acc.trim()) speak(acc);
      else
        toast(
          t(
            "الموديل مزحوم دلوقتي (الحد المجاني) — استنى دقيقة وجرّب تاني",
            "The model is busy (free-tier limit) — wait a minute and try again",
          ),
          "error",
        );
    } catch {
      toast(t("مش قادرة أعيد دلوقتي، جرّب تاني", "Couldn't regenerate now, try again"), "error");
    } finally {
      setStreaming(false);
      router.refresh();
    }
  }

  async function deleteMessage(id: string) {
    if (id.startsWith("tmp-") || id.startsWith("draft-")) return;
    const ok = await confirm({
      title: t("تمسح الرسالة دي؟", "Delete this message?"),
      body: t(`${assistantName} هتنساها خالص.`, `${assistantName} will forget it completely.`),
      confirmText: t("امسح", "Delete"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    setMessages((m) => m.filter((x) => x.id !== id));
    router.refresh();
  }

  // --- fork: lift a slice of the chat out into its own side conversation ---
  // Only on the main timeline; side/incognito stay as they are.
  const canFork = conversationType === "main";
  const [forkMode, setForkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forking, setForking] = useState(false);

  function startFork(id: string) {
    setForkMode(true);
    setSelected(new Set([id]));
  }
  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  async function markTaskDone(msgId: string, taskId?: string) {
    if (!taskId) return;
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, taskDone: true } : x)));
    await fetch(`/api/tasks/${taskId}`, { method: "PATCH" }).catch(() => {});
  }
  function cancelFork() {
    setForkMode(false);
    setSelected(new Set());
  }
  async function doFork() {
    const ids = messages
      .filter(
        (m) =>
          selected.has(m.id) &&
          !m.sideCardId &&
          !m.id.startsWith("tmp-") &&
          !m.id.startsWith("draft-"),
      )
      .map((m) => m.id);
    if (ids.length === 0 || forking) return;
    setForking(true);
    try {
      const res = await fetch("/api/chat/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConversationId: conversationId, messageIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "fork failed");
      }
      const data = await res.json();
      toast(t("اتنقلت لمحادثة جانبية ✨", "Moved into a side chat ✨"), "success");
      router.push(`/chat/${data.conversation.id}`);
    } catch {
      toast(t("مش قادرة أنقلها دلوقتي، جرّب تاني", "Couldn't move it now, try again"), "error");
      setForking(false);
    }
  }

  const banner = TYPE_BANNER[conversationType];
  // The most recent user message — that's where the regenerate button lives.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && !messages[i].id.startsWith("tmp-")) {
      lastUserIdx = i;
      break;
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {conversationType === "incognito" ? (
        <button
          onClick={() => {
            setScen(scenario ?? scen);
            setScenOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 text-[12px] text-muted py-1.5 px-3 bg-elevated/60 border-b border-border hover:text-ink transition-theme w-full"
        >
          <Glasses className="size-3.5 shrink-0" />
          <span className="truncate">
            {scen?.trim()
              ? `🎬 ${scen.trim()}`
              : t("وضع تخيّلي — اضغط لكتابة سيناريو", "Imaginary mode — tap to write a scenario")}
          </span>
          <Pencil className="size-3 shrink-0 opacity-70" />
        </button>
      ) : banner ? (
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted py-1.5 bg-elevated/60 border-b border-border">
          {banner.icon}
          {t("محادثة جانبية — بتتسجّل في ذاكرتها العامة.", "Side chat — saved to her general memory.")}
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 sm:px-4 py-5 max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <EmptyState
              icon={<Avatar name={assistantName} photo={assistantPhoto} size="lg" mood={assistantMood} />}
              title={t(`ابدأ كلامك مع ${assistantName}`, `Start chatting with ${assistantName}`)}
            >
              {t("اكتب أي حاجة في بالك 👋", "Say anything on your mind 👋")}
            </EmptyState>
          ) : (
            messages.map((m, i) =>
              m.sideCardId ? (
                <button
                  key={m.id}
                  onClick={() => router.push(`/chat/${m.sideCardId}`)}
                  className="self-center w-full max-w-sm flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-soft hover:bg-elevated transition-theme animate-fade-in"
                >
                  <span className="grid place-items-center size-9 rounded-xl bg-accent-soft text-accent shrink-0">
                    <MessageCircleHeart className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0 text-start">
                    <div className="text-[11px] text-muted">{t("محادثة جانبية", "Side chat")}</div>
                    <div className="text-ink font-medium truncate">{m.content}</div>
                  </div>
                  <span className="text-xs text-accent font-semibold shrink-0">{t("افتح", "Open")}</span>
                </button>
              ) : (
                <Bubble
                  key={m.id}
                  msg={m}
                  assistantName={assistantName}
                  assistantPhoto={assistantPhoto}
                  assistantMood={assistantMood}
                  streaming={streaming}
                  onDelete={() => deleteMessage(m.id)}
                  onReact={(e) => react(m.id, e)}
                  onReply={() => setReplyingTo(m)}
                  canRegenerate={i === lastUserIdx}
                  onRegenerate={regenerate}
                  canFork={canFork}
                  onFork={() => startFork(m.id)}
                  forkMode={forkMode}
                  selected={selected.has(m.id)}
                  onToggleSelect={() => toggleSelect(m.id)}
                  onMarkTask={() => markTaskDone(m.id, m.taskId)}
                  ephemeral={conversationType === "incognito"}
                />
              ),
            )
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-surface/80 backdrop-blur-md px-3 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
        {forkMode ? (
          <div className="max-w-3xl mx-auto flex items-center gap-2 animate-slide-up">
            <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted">
              <GitBranch className="size-4 shrink-0 text-accent" />
              <span className="truncate">
                {t(
                  `اختار الرسائل اللي تتنقل لمحادثة جانبية (${selected.size})`,
                  `Pick messages to move into a side chat (${selected.size})`,
                )}
              </span>
            </div>
            <Button variant="ghost" onClick={cancelFork} disabled={forking}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button loading={forking} disabled={selected.size === 0} onClick={doFork}>
              {t("انقل", "Move")} {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        ) : (
        <div className="max-w-3xl mx-auto space-y-2">
          {replyingTo && (
            <div className="flex items-center gap-2 rounded-xl border-s-2 border-accent bg-elevated/60 px-3 py-2 animate-slide-up">
              <Reply className="size-4 shrink-0 text-accent" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-accent font-semibold">
                  {replyingTo.role === "user"
                    ? t("بترد على رسالتك", "Replying to you")
                    : t(`بترد على ${assistantName}`, `Replying to ${assistantName}`)}
                </div>
                <div className="text-xs text-muted truncate">{replyingTo.content}</div>
              </div>
              <IconButton size="sm" onClick={() => setReplyingTo(null)} aria-label={t("إلغاء", "Cancel")}>
                <X className="size-4" />
              </IconButton>
            </div>
          )}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-16 rounded-xl object-cover border border-border" />
                  <button
                    onClick={() => setImages((im) => im.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -left-1.5 size-5 grid place-items-center rounded-full bg-overlay text-white shadow-soft"
                    aria-label="شيل الصورة"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => pickImages(e.target.files)}
            />
            <button
              onClick={toggleTts}
              aria-label="قراءة بصوت"
              title={ttsOn ? "النطق مفعّل" : "النطق مقفول"}
              className={cn(
                "shrink-0 size-11 grid place-items-center rounded-2xl transition-theme active:scale-95",
                ttsOn ? "bg-accent-soft text-accent" : "bg-elevated text-muted hover:text-ink",
              )}
            >
              {ttsOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={streaming || images.length >= 4}
              aria-label="إرفاق صورة"
              className="shrink-0 size-11 grid place-items-center rounded-2xl bg-elevated text-muted hover:text-ink disabled:opacity-40 active:scale-95 transition-theme"
            >
              <ImagePlus className="size-5" />
            </button>
            <button
              onClick={toggleMic}
              disabled={transcribing}
              aria-label={listening ? t("وقّف التسجيل", "Stop recording") : t("سجّل صوت", "Record voice")}
              className={cn(
                "shrink-0 size-11 grid place-items-center rounded-2xl transition-theme active:scale-95 disabled:opacity-60",
                listening
                  ? "bg-danger text-white animate-pulse-glow"
                  : "bg-elevated text-muted hover:text-ink",
              )}
            >
              {transcribing ? (
                <span className="size-4 rounded-full border-2 border-muted/40 border-t-muted animate-spin" />
              ) : (
                <Mic className="size-5" />
              )}
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds a new line; send with the button or Ctrl/⌘+Enter.
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={t(`اكتب لـ ${assistantName}...`, `Message ${assistantName}...`)}
              className="flex-1 resize-none rounded-2xl bg-bg border border-border px-4 py-3 text-ink placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme max-h-40 leading-relaxed"
            />
            <button
              onClick={send}
              disabled={streaming || (!input.trim() && images.length === 0)}
              aria-label="ابعت"
              className="shrink-0 size-12 grid place-items-center rounded-2xl bg-gradient-to-b from-gold to-amber text-on-accent shadow-soft disabled:opacity-40 active:scale-95 transition-theme"
            >
              <SendHorizontal className="size-5 -scale-x-100" />
            </button>
          </div>
        </div>
        )}
      </div>

      {/* scenario editor (incognito) */}
      {scenOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-overlay/55 animate-fade-in"
          onClick={() => setScenOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-raised animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-1">
              <Glasses className="size-5 text-accent" />
              <h2 className="text-lg font-bold text-ink">{t("سيناريو المشهد", "Scene scenario")}</h2>
            </div>
            <p className="text-sm text-muted mb-3">
              {t(
                `اكتب الدور/المشهد اللي عايز ${assistantName} تمشي عليه. سيبه فاضي عشان تلغيه.`,
                `Describe the role/scene for ${assistantName} to follow. Leave empty to clear it.`,
              )}
            </p>
            <textarea
              value={scen}
              onChange={(e) => setScen(e.target.value)}
              rows={4}
              autoFocus
              placeholder="مثلاً: إحنا في مقهى، وإنتي صاحبتي القديمة..."
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme resize-none"
            />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" block onClick={() => setScenOpen(false)}>
                {t("إلغاء", "Cancel")}
              </Button>
              <Button block loading={scenSaving} onClick={saveScenario}>
                {t("حفظ", "Save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  msg,
  assistantName,
  assistantPhoto,
  assistantMood,
  streaming,
  onDelete,
  onReact,
  onReply,
  canRegenerate,
  onRegenerate,
  canFork,
  onFork,
  forkMode,
  selected,
  onToggleSelect,
  onMarkTask,
  ephemeral,
}: {
  msg: Msg;
  assistantName: string;
  assistantPhoto?: string | null;
  assistantMood: "happy" | "calm" | "upset";
  streaming: boolean;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  canFork?: boolean;
  onFork?: () => void;
  forkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onMarkTask?: () => void;
  /** incognito: voice audio must not be cached server-side */
  ephemeral?: boolean;
}) {
  const { t } = useI18n();
  const isUser = msg.role === "user";
  // Split on blank lines into separate bubbles. Markdown renders each segment, so
  // single line-breaks flow as spaces while real lists/blocks render properly.
  const parts = msg.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const isEmptyDraft = !isUser && msg.content === "" && streaming;
  const isTemp = msg.id.startsWith("tmp-") || msg.id.startsWith("draft-");
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      id={`msg-${msg.id}`}
      onClick={forkMode && !isTemp ? onToggleSelect : undefined}
      className={cn(
        "group flex items-end gap-2 animate-slide-up scroll-mt-20",
        // RTL: user on the right (self-start), assistant on the left (self-end).
        // The assistant row also carries the avatar (size-8) + gap, so give it
        // that 2.5rem back so her bubble can grow as wide as the user's.
        isUser
          ? "self-start flex-row max-w-[88%] sm:max-w-[80%]"
          : "self-end flex-row-reverse max-w-[calc(88%+2.5rem)] sm:max-w-[calc(80%+2.5rem)]",
        forkMode && !isTemp && "cursor-pointer rounded-2xl -mx-1 px-1 transition-theme",
        forkMode && selected && "bg-accent-soft/60 ring-1 ring-accent",
      )}
    >
      {forkMode && !isTemp && (
        <span
          className={cn(
            "shrink-0 self-center size-5 grid place-items-center rounded-full border transition-theme",
            selected ? "bg-accent border-accent text-on-accent" : "border-border text-transparent",
          )}
        >
          <Check className="size-3.5" />
        </span>
      )}
      {!isUser && <Avatar name={assistantName} photo={assistantPhoto} size="sm" mood={assistantMood} className="mb-0.5" />}

      <div className="relative space-y-1.5 min-w-0">
        {msg.images?.length ? (
          <div className="flex gap-1.5 flex-wrap">
            {msg.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="max-w-[12rem] max-h-48 rounded-2xl border border-border object-cover shadow-soft"
              />
            ))}
          </div>
        ) : null}
        {msg.replyTo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              document
                .getElementById(`msg-${msg.replyTo!.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className={cn(
              "block w-full text-start rounded-xl border-s-2 px-2.5 py-1.5 mb-1",
              isUser
                ? "border-on-accent/50 bg-on-accent/10"
                : "border-accent/60 bg-elevated/60",
            )}
          >
            <span className="block text-[11px] text-muted truncate">{msg.replyTo.preview}</span>
          </button>
        )}
        {isEmptyDraft ? (
          <TypingDots />
        ) : msg.voice && msg.content ? (
          <VoiceNote text={msg.content} ephemeral={ephemeral} />
        ) : !msg.content ? null : (
          (parts.length ? parts : [msg.content]).map((p, i) => (
            <div
              key={i}
              className={cn(
                "break-words rounded-2xl px-4 py-2.5 leading-relaxed text-[15px]",
                isUser
                  ? "bg-gradient-to-br from-gold to-amber text-on-accent rounded-tr-md shadow-soft"
                  : "bg-surface border border-border text-ink rounded-tl-md shadow-soft",
              )}
            >
              <Markdown>{p}</Markdown>
            </div>
          ))
        )}

        {msg.reaction && (
          <div className={cn("absolute -bottom-2.5 z-10", isUser ? "left-2" : "right-2")}>
            <span className="inline-flex items-center rounded-full bg-surface border border-border px-1.5 py-0.5 text-[13px] leading-none shadow-soft">
              {msg.reaction}
            </span>
          </div>
        )}

        {msg.taskId && (
          <button
            onClick={onMarkTask}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-theme",
              msg.taskDone
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-bg text-muted hover:text-ink",
            )}
          >
            {msg.taskDone ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
            {msg.taskDone ? t("اتعملت ✅", "Done ✅") : t("خلّصتها", "Mark done")}
          </button>
        )}
      </div>

      {!isEmptyDraft && !isTemp && !forkMode && (
        <div className="relative self-center flex items-center">
          {canRegenerate && !streaming && onRegenerate && (
            <IconButton size="sm" onClick={onRegenerate} aria-label="إعادة توليد" title="Regenerate">
              <RotateCcw className="size-3.5" />
            </IconButton>
          )}
          {canFork && onFork && (
            <IconButton size="sm" subtle onClick={onFork} aria-label="نقل لمحادثة جانبية" title="Fork">
              <GitBranch className="size-3.5" />
            </IconButton>
          )}
          {onReply && (
            <IconButton size="sm" subtle onClick={onReply} aria-label="رد" title="Reply">
              <Reply className="size-3.5" />
            </IconButton>
          )}
          <IconButton size="sm" subtle onClick={() => setPickerOpen((o) => !o)} aria-label="تفاعل">
            <SmilePlus className="size-3.5" />
          </IconButton>
          <IconButton size="sm" subtle onClick={onDelete} aria-label="حذف">
            <Trash2 className="size-3.5" />
          </IconButton>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
              <div className="absolute bottom-full mb-1 z-30 flex gap-1 bg-surface border border-border rounded-full px-2 py-1 shadow-raised animate-pop">
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      onReact(e);
                      setPickerOpen(false);
                    }}
                    className="text-lg leading-none hover:scale-125 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-3.5 shadow-soft">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-muted animate-typing"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
