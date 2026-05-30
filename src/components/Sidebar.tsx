"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import {
  Brain,
  Crown,
  Glasses,
  LogOut,
  MessageCirclePlus,
  Pin,
  Settings,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export type Conv = { id: string; type: "main" | "side" | "incognito"; title: string | null };
type MoodKind = "happy" | "calm" | "upset";

const TYPE_META: Record<Conv["type"], { Icon: typeof Pin; label: string }> = {
  main: { Icon: Pin, label: "الرئيسية" },
  side: { Icon: MessageCirclePlus, label: "محادثة جانبية" },
  incognito: { Icon: Glasses, label: "تخيّلي" },
};

export function Sidebar(props: {
  assistantName: string;
  mood: MoodKind;
  moodLabel: string;
  isAdmin: boolean;
  conversations: Conv[];
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const confirm = useConfirm();
  const toast = useToast();
  const [convs, setConvs] = useState<Conv[]>(props.conversations);
  const [busy, setBusy] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenario, setScenario] = useState("");

  const go = (href: string) => {
    props.onNavigate?.();
    router.push(href);
  };

  async function create(type: "side" | "incognito", scenarioText?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, scenario: scenarioText || undefined }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConvs((c) => [{ id: data.conversation.id, type, title: null }, ...c]);
        go(`/chat/${data.conversation.id}`);
      } else {
        toast("مش قادرة أعمل المحادثة دلوقتي", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "تمسح المحادثة دي؟",
      body: "هتتشال خالص من هنا.",
      confirmText: "امسح",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConvs((c) => c.filter((x) => x.id !== id));
    if (params.conversationId === id) go("/chat");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const main = convs.find((c) => c.type === "main");
  const others = convs.filter((c) => c.type !== "main");

  return (
    <aside className="w-72 max-w-[82vw] h-dvh flex flex-col bg-surface border-l border-border">
      {/* header */}
      <div className="p-4 pt-safe flex items-center gap-3 border-b border-border">
        <Avatar name={props.assistantName} size="lg" mood={props.mood} />
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-ink leading-tight truncate">
            {props.assistantName}
          </div>
          <div className="text-xs text-muted leading-tight truncate">{props.moodLabel}</div>
        </div>
      </div>

      {/* new conversation */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          onClick={() => create("side")}
          className="flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl bg-accent-soft text-ink px-3 py-2.5 hover:brightness-95 transition-theme disabled:opacity-50"
        >
          <MessageCirclePlus className="size-4" /> جانبية
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setScenario("");
            setScenarioOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl bg-elevated text-ink px-3 py-2.5 hover:brightness-95 transition-theme disabled:opacity-50"
        >
          <Glasses className="size-4" /> تخيّلي
        </button>
      </div>

      {/* conversations */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {main && (
          <ConvItem
            conv={main}
            active={params.conversationId === main.id}
            onOpen={(id) => go(`/chat/${id}`)}
          />
        )}
        {others.length > 0 && (
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-faint">المحادثات</div>
        )}
        {others.map((c) => (
          <ConvItem
            key={c.id}
            conv={c}
            active={params.conversationId === c.id}
            onOpen={(id) => go(`/chat/${id}`)}
            onDelete={() => remove(c.id)}
          />
        ))}
      </nav>

      {/* footer */}
      <div className="p-2 pb-safe border-t border-border space-y-0.5">
        <FooterLink icon={<Brain className="size-[18px]" />} label="الذاكرة" onClick={() => go("/memories")} />
        <FooterLink icon={<Settings className="size-[18px]" />} label="الإعدادات" onClick={() => go("/settings")} />
        {props.isAdmin && (
          <FooterLink icon={<Crown className="size-[18px]" />} label="لوحة الأدمن" onClick={() => go("/admin")} />
        )}
        <FooterLink icon={<LogOut className="size-[18px]" />} label="خروج" muted onClick={logout} />
      </div>

      {/* incognito scenario modal */}
      {scenarioOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-overlay/55 animate-fade-in"
          onClick={() => setScenarioOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-raised animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-1">
              <Glasses className="size-5 text-accent" />
              <h2 className="text-lg font-bold text-ink">وضع تخيّلي جديد</h2>
            </div>
            <p className="text-sm text-muted mb-3">
              اكتب سيناريو/مشهد (اختياري) ونورا هتعيش الدور. اللي هنا مش هيتسجّل في ذاكرتها، ومش
              هيتمسح غير لما إنت تمسحه.
            </p>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={4}
              autoFocus
              placeholder="مثلاً: إحنا في مقهى، وإنتي صاحبتي القديمة اللي مقابلتهاش من سنين..."
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme resize-none"
            />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" block onClick={() => setScenarioOpen(false)}>
                إلغاء
              </Button>
              <Button
                block
                loading={busy}
                onClick={() => {
                  setScenarioOpen(false);
                  create("incognito", scenario.trim());
                }}
              >
                ابدأ المشهد
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function FooterLink({
  icon,
  label,
  onClick,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-theme hover:bg-elevated",
        muted ? "text-muted" : "text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ConvItem(props: {
  conv: Conv;
  active: boolean;
  onOpen: (id: string) => void;
  onDelete?: () => void;
}) {
  const { Icon, label } = TYPE_META[props.conv.type];
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-theme",
        props.active ? "bg-accent-soft text-ink" : "hover:bg-elevated text-ink/90",
      )}
      onClick={() => props.onOpen(props.conv.id)}
    >
      <Icon className={cn("size-4 shrink-0", props.active ? "text-accent" : "text-muted")} />
      <span className="flex-1 text-sm truncate">{props.conv.title || label}</span>
      {props.onDelete && (
        <IconButton
          size="sm"
          subtle
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete?.();
          }}
          aria-label="حذف"
        >
          <Trash2 className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
