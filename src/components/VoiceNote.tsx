"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Pause, Play } from "lucide-react";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

/**
 * A voice-note bubble for her messages. Plays the line in her real voice via
 * /api/tts (ElevenLabs), falling back to the browser voice. The text is kept as a
 * transcript you can reveal.
 */
export function VoiceNote({ text }: { text: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [showText, setShowText] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setState("idle");
  }

  async function toggle() {
    if (state === "playing" || state === "loading") return stop();
    const clean = text.replace(/[*_#`>~]/g, "").trim();
    if (!clean) return;
    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url);
        audioRef.current = a;
        a.onended = () => {
          setState("idle");
          URL.revokeObjectURL(url);
        };
        await a.play();
        setState("playing");
        return;
      }
    } catch {
      /* fall through */
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "ar-EG";
      u.onend = () => setState("idle");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setState("playing");
    } else {
      setState("idle");
    }
  }

  return (
    <div className="rounded-2xl rounded-tl-md px-3 py-2.5 bg-surface border border-border shadow-soft min-w-[190px] max-w-full">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          aria-label={t("شغّل", "Play")}
          className="size-9 grid place-items-center rounded-full bg-accent text-on-accent shrink-0 active:scale-95 transition-transform"
        >
          {state === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state === "playing" ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-accent/60", state === "playing" && "animate-pulse")}
              style={{ width: state === "playing" ? "100%" : "35%" }}
            />
          </div>
          <div className="text-[10px] text-muted mt-1 flex items-center gap-1">
            <Mic className="size-3" /> {t("رسالة صوتية", "Voice message")}
          </div>
        </div>
      </div>
      <button
        onClick={() => setShowText((s) => !s)}
        className="text-[11px] text-muted mt-1.5 hover:text-ink transition-theme"
      >
        {showText ? t("اخفي النص", "Hide text") : t("النص", "Transcript")}
      </button>
      {showText && <div className="text-sm text-ink mt-1 leading-relaxed text-start">{text}</div>}
    </div>
  );
}
