"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { useI18n } from "@/components/i18n";

type KeyItem = { id: string; masked: string; length: number };

/**
 * Manage the global LLM key pool as individual, removable cards — replacing the
 * old write-only textarea. Keys are shown masked (first/last few chars) so you can
 * tell which is which, and a bad key can be deleted on its own.
 */
export function ApiKeyManager() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/settings/provider/keys");
      if (res.ok) setKeys((await res.json()).keys ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const key = newKey.trim();
    if (key.length < 8) {
      toast(t("المفتاح قصير جداً", "Key looks too short"), "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/settings/provider/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast(t("المفتاح ده مضاف قبل كده", "That key is already added"), "error");
        return;
      }
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أضيف", "Couldn't add"), "error");
        return;
      }
      setKeys(data.keys ?? []);
      setNewKey("");
      toast(t("اتضاف ✅", "Added ✅"), "success");
    } finally {
      setAdding(false);
    }
  }

  async function remove(item: KeyItem) {
    const ok = await confirm({
      title: t(`تمسح المفتاح ${item.masked}؟`, `Remove key ${item.masked}?`),
      confirmText: t("امسح", "Remove"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    const res = await fetch("/api/settings/provider/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error ?? t("مش قادر أمسح", "Couldn't remove"), "error");
      return;
    }
    setKeys(data.keys ?? []);
    toast(t("اتمسح", "Removed"), "success");
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-ink flex items-center gap-1.5">
        <KeyRound className="size-4 text-accent" />
        {t("مفاتيح الـ API", "API keys")}
        {!loading && (
          <span className="text-xs text-muted font-normal">
            ({keys.length} {t("مفتاح", keys.length === 1 ? "key" : "keys")})
          </span>
        )}
      </div>
      <p className="text-xs text-muted leading-relaxed">
        {t(
          "بيتبدّل بينهم تلقائياً لو واحد وصل حده. كل مفتاح بيظهر مخفي عشان تعرفه من غير ما يتكشف.",
          "Rotated automatically when one is rate-limited. Each key is shown masked so you can recognize it without exposing it.",
        )}
      </p>

      {/* existing keys as cards */}
      {loading ? (
        <div className="h-12 rounded-xl bg-bg border border-border animate-pulse" />
      ) : keys.length === 0 ? (
        <div className="text-sm text-muted bg-bg border border-dashed border-border rounded-xl px-4 py-3">
          {t("مفيش مفاتيح متسجّلة لسه — ضيف واحد تحت.", "No keys yet — add one below.")}
        </div>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-2.5 animate-fade-in"
            >
              <span className="grid place-items-center size-8 rounded-lg bg-accent-soft text-accent shrink-0">
                <KeyRound className="size-4" />
              </span>
              <code dir="ltr" className="flex-1 min-w-0 truncate text-sm text-ink font-mono">
                {k.masked}
              </code>
              <IconButton
                size="sm"
                onClick={() => remove(k)}
                aria-label={t("امسح", "Remove")}
                className="text-muted hover:text-danger"
              >
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {/* add new */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            dir="ltr"
            placeholder="AIza... / sk-or-..."
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={add} loading={adding}>
          <Plus className="size-4" /> {t("ضيف", "Add")}
        </Button>
      </div>
    </div>
  );
}
