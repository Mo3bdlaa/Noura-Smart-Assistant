"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import {
  Bell,
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
import { useI18n } from "@/components/i18n";
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
  assistantPhoto?: string | null;
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
  const { t } = useI18n();
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
        toast(t("مش قادرة أعمل المحادثة دلوقتي", "Couldn't start the chat right now"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: t("تمسح المحادثة دي؟", "Delete this chat?"),
      body: t("هتتشال خالص من هنا.", "It will be removed for good."),
      confirmText: t("امسح", "Delete"),
      cancelText: t("إلغاء", "Cancel"),
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
      {/* header → profile */}
      <button
        onClick={() => go("/profile")}
        className="p-4 pt-safe flex items-center gap-3 border-b border-border text-start hover:bg-elevated/50 transition-theme"
      >
        <Avatar name={props.assistantName} photo={props.assistantPhoto} size="lg" mood={props.mood} />
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-ink leading-tight truncate">
            {props.assistantName}
          </div>
          <div className="text-xs text-muted leading-tight truncate">{props.moodLabel}</div>
        </div>
      </button>

      {/* new conversation */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          onClick={() => create("side")}
          className="flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl bg-accent-soft text-ink px-3 py-2.5 hover:brightness-95 transition-theme disabled:opacity-50"
        >
          <MessageCirclePlus className="size-4" /> {t("جانبية", "Side")}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setScenario("");
            setScenarioOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl bg-elevated text-ink px-3 py-2.5 hover:brightness-95 transition-theme disabled:opacity-50"
        >
          <Glasses className="size-4" /> {t("تخيّلي", "Imaginary")}
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
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-faint">{t("المحادثات", "Chats")}</div>
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
        <FooterLink icon={<Brain className="size-[18px]" />} label={t("الذاكرة", "Memory")} onClick={() => go("/memories")} />
        <FooterLink icon={<Bell className="size-[18px]" />} label={t("التذكيرات", "Reminders")} onClick={() => go("/reminders")} />
        <FooterLink icon={<Settings className="size-[18px]" />} label={t("الإعدادات", "Settings")} onClick={() => go("/settings")} />
        {props.isAdmin && (
          <FooterLink icon={<Crown className="size-[18px]" />} label={t("لوحة الأدمن", "Admin")} onClick={() => go("/admin")} />
        )}
        <FooterLink icon={<LogOut className="size-[18px]" />} label={t("خروج", "Log out")} muted onClick={logout} />
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
              <h2 className="text-lg font-bold text-ink">{t("وضع تخيّلي جديد", "New imaginary mode")}</h2>
            </div>
            <p className="text-sm text-muted mb-3">
              {t(
                "اكتب سيناريو/مشهد (اختياري) وهي هتعيش الدور. اللي هنا مش هيتسجّل في ذاكرتها، ومش هيتمسح غير لما إنت تمسحه.",
                "Write an optional scenario/scene and she'll play the role. Nothing here is saved to her memory, and it's only removed when you delete it.",
              )}
            </p>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={4}
              autoFocus
              placeholder={t(
                "مثلاً: إحنا في مقهى، وإنتي صاحبتي القديمة اللي مقابلتهاش من سنين...",
                "e.g. We're at a café, and you're an old friend I haven't seen in years...",
              )}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme resize-none"
            />
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" block onClick={() => setScenarioOpen(false)}>
                {t("إلغاء", "Cancel")}
              </Button>
              <Button
                block
                loading={busy}
                onClick={() => {
                  setScenarioOpen(false);
                  create("incognito", scenario.trim());
                }}
              >
                {t("ابدأ المشهد", "Start scene")}
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
  const { t } = useI18n();
  const { Icon } = TYPE_META[props.conv.type];
  const label =
    props.conv.type === "main"
      ? t("الرئيسية", "Main")
      : props.conv.type === "side"
        ? t("محادثة جانبية", "Side chat")
        : t("تخيّلي", "Imaginary");
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
