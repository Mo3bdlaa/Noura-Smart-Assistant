"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Glasses, MessageCircleHeart, SendHorizontal, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { cn } from "@/lib/cn";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type Props = {
  conversationId: string;
  conversationType: "main" | "side" | "incognito";
  assistantName: string;
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
  assistantName,
  assistantMood,
  initialMessages,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    setMessages(initialMessages);
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
    if (!text || streaming) return;
    setInput("");
    const userMsg: Msg = { id: `tmp-${Date.now()}`, role: "user", content: text };
    const draftId = `draft-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: draftId, role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "حصل خطأ، جرّب تاني");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, content: acc } : x)));
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

  async function deleteMessage(id: string) {
    if (id.startsWith("tmp-") || id.startsWith("draft-")) return;
    const ok = await confirm({
      title: "تمسح الرسالة دي؟",
      body: `${assistantName} هتنساها خالص.`,
      confirmText: "امسح",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    setMessages((m) => m.filter((x) => x.id !== id));
    router.refresh();
  }

  const banner = TYPE_BANNER[conversationType];

  return (
    <div className="flex flex-col h-full min-h-0">
      {banner && (
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted py-1.5 bg-elevated/60 border-b border-border">
          {banner.icon}
          {banner.text}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 sm:px-4 py-5 max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <EmptyState
              icon={<Avatar name={assistantName} size="lg" mood={assistantMood} />}
              title={`ابدأ كلامك مع ${assistantName}`}
            >
              اكتب أي حاجة في بالك 👋
            </EmptyState>
          ) : (
            messages.map((m) => (
              <Bubble
                key={m.id}
                msg={m}
                assistantName={assistantName}
                assistantMood={assistantMood}
                streaming={streaming}
                onDelete={() => deleteMessage(m.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border bg-surface/80 backdrop-blur-md p-3 pb-safe">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`اكتب لـ ${assistantName}...`}
            className="flex-1 resize-none rounded-2xl bg-bg border border-border px-4 py-3 text-ink placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme max-h-40 leading-relaxed"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            aria-label="ابعت"
            className="shrink-0 size-12 grid place-items-center rounded-2xl bg-gradient-to-b from-gold to-amber text-on-accent shadow-soft disabled:opacity-40 active:scale-95 transition-theme"
          >
            <SendHorizontal className="size-5 -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  assistantName,
  assistantMood,
  streaming,
  onDelete,
}: {
  msg: Msg;
  assistantName: string;
  assistantMood: "happy" | "calm" | "upset";
  streaming: boolean;
  onDelete: () => void;
}) {
  const isUser = msg.role === "user";
  const parts = msg.content.split(/\n{2,}/).filter(Boolean);
  const isEmptyDraft = !isUser && msg.content === "" && streaming;

  return (
    <div
      className={cn(
        "group flex items-end gap-2 max-w-[88%] sm:max-w-[78%] animate-slide-up",
        isUser ? "self-end" : "self-start",
      )}
    >
      {!isUser && <Avatar name={assistantName} size="sm" mood={assistantMood} className="mb-0.5" />}

      <div className={cn("space-y-1.5 min-w-0", isUser && "flex flex-col items-end")}>
        {isEmptyDraft ? (
          <TypingDots />
        ) : (
          (parts.length ? parts : [msg.content || "…"]).map((p, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 leading-relaxed text-[15px]",
                isUser
                  ? "bg-gradient-to-br from-gold to-amber text-on-accent rounded-tl-md shadow-soft"
                  : "bg-surface border border-border text-ink rounded-tr-md shadow-soft",
              )}
            >
              {p}
            </div>
          ))
        )}
      </div>

      <IconButton size="sm" subtle onClick={onDelete} aria-label="حذف" className="self-center">
        <Trash2 className="size-3.5" />
      </IconButton>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="bg-surface border border-border rounded-2xl rounded-tr-md px-4 py-3.5 shadow-soft">
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
