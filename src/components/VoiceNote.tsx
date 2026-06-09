"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Pause, Play } from "lucide-react";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * A voice-note bubble for her messages. Plays the line in her real voice via
 * /api/tts (Gemini TTS), falling back to the browser voice. Shows real playback
 * progress; the text is kept as a revealable transcript.
 */
export function VoiceNote({ text }: { text: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [progress, setProgress] = useState(0); // 0..1
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [realAudio, setRealAudio] = useState(false); // false = browser-TTS (no seek bar)
  const [showText, setShowText] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopBrowser() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  function reset() {
    setState("idle");
    setProgress(0);
    setElapsed(0);
  }

  async function toggle() {
    if (state === "playing") {
      if (audioRef.current) {
        audioRef.current.pause();
        setState("paused");
      } else {
        stopBrowser();
        reset();
      }
      return;
    }
    if (state === "paused" && audioRef.current) {
      await audioRef.current.play();
      setState("playing");
      return;
    }

    const clean = text.replace(/[*_#`>~]/g, "").trim();
    if (!clean) return;
    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url);
        audioRef.current = a;
        setRealAudio(true);
        a.onloadedmetadata = () => setDuration(a.duration || 0);
        a.ontimeupdate = () => {
          setElapsed(a.currentTime);
          if (a.duration) setProgress(a.currentTime / a.duration);
        };
        a.onended = () => {
          reset();
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        await a.play();
        setState("playing");
        return;
      }
    } catch {
      /* fall through to browser voice */
    }
    // Browser fallback — no real timeline, show an indeterminate playing state.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      audioRef.current = null;
      setRealAudio(false);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "ar-EG";
      u.onend = () => reset();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setState("playing");
    } else {
      reset();
    }
  }

  const active = state === "playing" || state === "paused";

  return (
    <div className="rounded-2xl rounded-tl-md px-3 py-2.5 bg-surface border border-border shadow-soft min-w-[200px] max-w-full">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          aria-label={state === "playing" ? t("وقّف", "Pause") : t("شغّل", "Play")}
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
            {realAudio ? (
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            ) : (
              <div
                className={cn(
                  "h-full rounded-full bg-accent/60",
                  state === "playing" ? "animate-pulse w-full" : "w-0",
                )}
              />
            )}
          </div>
          <div className="text-[10px] text-muted mt-1 flex items-center gap-1">
            <Mic className="size-3" />
            {realAudio && active ? `${fmt(elapsed)} / ${fmt(duration)}` : t("رسالة صوتية", "Voice message")}
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
