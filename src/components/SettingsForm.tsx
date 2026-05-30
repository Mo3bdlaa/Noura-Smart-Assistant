"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cpu, Languages, LogOut, Lock, Settings, Smartphone, User } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { NotificationsCard } from "@/components/NotificationsCard";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

const TIMEZONES = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Jerusalem",
  "Asia/Baghdad",
  "Africa/Casablanca",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
];

export function SettingsForm({
  isAdmin,
  initial,
  provider,
}: {
  isAdmin: boolean;
  initial: { displayName: string; timezone: string; assistantName: string };
  provider?: { baseUrl: string; chatModel: string; embedModel: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { locale, setLocale, t } = useI18n();

  const [profile, setProfile] = useState(initial);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [prov, setProv] = useState({
    baseUrl: provider?.baseUrl ?? "",
    apiKey: "",
    chatModel: provider?.chatModel ?? "",
    embedModel: provider?.embedModel ?? "",
  });
  const [savingProv, setSavingProv] = useState(false);

  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    setSavingProv(true);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prov),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أحفظ", "Couldn't save"), "error");
        return;
      }
      toast(t("إعدادات المزوّد اتحفظت ✅", "Provider settings saved ✅"), "success");
      setProv((p) => ({ ...p, apiKey: "" }));
    } finally {
      setSavingProv(false);
    }
  }

  const tzOptions = Array.from(new Set([initial.timezone, ...TIMEZONES]));

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أحفظ", "Couldn't save"), "error");
        return;
      }
      toast(t("اتحفظ ✅", "Saved ✅"), "success");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pw),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أغيّر الباسورد", "Couldn't change password"), "error");
        return;
      }
      toast(t("الباسورد اتغيّر ✅", "Password changed ✅"), "success");
      setPw({ currentPassword: "", newPassword: "" });
    } finally {
      setSavingPw(false);
    }
  }

  async function logout() {
    const ok = await confirm({
      title: t("تسجيل خروج؟", "Log out?"),
      confirmText: t("خروج", "Log out"),
      cancelText: t("إلغاء", "Cancel"),
    });
    if (!ok) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <PageShell title={t("الإعدادات", "Settings")} icon={<Settings className="size-5" />}>
      <div className="space-y-5">
        {/* language */}
        <Card className="p-5">
          <SectionTitle icon={<Languages className="size-4" />} title={t("اللغة", "Language")} />
          <div className="flex gap-2 mt-4">
            {(["ar", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-theme border",
                  locale === l
                    ? "bg-accent-soft text-accent border-accent/30"
                    : "bg-elevated text-muted border-transparent hover:text-ink",
                )}
              >
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </Card>

        {/* profile */}
        <Card className="p-5">
          <SectionTitle icon={<User className="size-4" />} title={t("حسابك ومساعدتك", "Your account & assistant")} />
          <form onSubmit={saveProfile} className="space-y-4 mt-4">
            <Field label={t("اسمك", "Your name")}>
              <Input
                value={profile.displayName}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
              />
            </Field>
            <Field
              label={t("اسم مساعدتك", "Assistant's name")}
              hint={
                isAdmin
                  ? t('إنت أدمن — تقدر تسميها "نورا"', 'You\'re admin — you can name her "Noura"')
                  : t('أي اسم (مش "نورا")', 'Any name (not "Noura")')
              }
            >
              <Input
                value={profile.assistantName}
                onChange={(e) => setProfile((p) => ({ ...p, assistantName: e.target.value }))}
              />
            </Field>
            <Field label={t("المنطقة الزمنية", "Time zone")} hint={t("عشان تحس بالوقت بتاعك صح", "So she senses your local time")}>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                className="w-full h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme"
              >
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" loading={savingProfile}>
              {t("حفظ", "Save")}
            </Button>
          </form>
        </Card>

        {/* password */}
        <Card className="p-5">
          <SectionTitle icon={<Lock className="size-4" />} title={t("تغيير الباسورد", "Change password")} />
          <form onSubmit={savePassword} className="space-y-4 mt-4">
            <Field label={t("الباسورد الحالي", "Current password")}>
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </Field>
            <Field label={t("الباسورد الجديد", "New password")} hint={t("٨ حروف على الأقل", "At least 8 characters")}>
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </Field>
            <Button type="submit" variant="outline" loading={savingPw}>
              {t("تغيير", "Change")}
            </Button>
          </form>
        </Card>

        {/* notifications */}
        <NotificationsCard />

        {/* LLM provider (admin only) */}
        {isAdmin && (
          <Card className="p-5">
            <SectionTitle icon={<Cpu className="size-4" />} title={t("مزوّد الذكاء (Provider)", "AI provider")} />
            <p className="text-sm text-muted mt-2 leading-relaxed">
              أي مزوّد متوافق مع OpenAI (Gemini الافتراضي، أو OpenAI / Groq / OpenRouter / Ollama
              محلي...). سيب المفتاح فاضي عشان تبقّي على الحالي.
            </p>
            <form onSubmit={saveProvider} className="space-y-4 mt-4">
              <Field label="Base URL">
                <Input
                  dir="ltr"
                  placeholder="https://..."
                  value={prov.baseUrl}
                  onChange={(e) => setProv((p) => ({ ...p, baseUrl: e.target.value }))}
                />
              </Field>
              <Field label="API Key" hint="مخزّن مشفّر؛ سيبه فاضي عشان متغيّروش">
                <Input
                  dir="ltr"
                  type="password"
                  placeholder="••••••••"
                  value={prov.apiKey}
                  onChange={(e) => setProv((p) => ({ ...p, apiKey: e.target.value }))}
                />
              </Field>
              <Field label="موديل الشات">
                <Input
                  dir="ltr"
                  placeholder="gemini-2.5-flash"
                  value={prov.chatModel}
                  onChange={(e) => setProv((p) => ({ ...p, chatModel: e.target.value }))}
                />
              </Field>
              <Field label="موديل الـ Embeddings" hint="لازم يدعم 768 بُعد">
                <Input
                  dir="ltr"
                  placeholder="gemini-embedding-001"
                  value={prov.embedModel}
                  onChange={(e) => setProv((p) => ({ ...p, embedModel: e.target.value }))}
                />
              </Field>
              <Button type="submit" variant="outline" loading={savingProv}>
                حفظ المزوّد
              </Button>
            </form>
          </Card>
        )}

        {/* install hint */}
        <Card className="p-5">
          <SectionTitle icon={<Smartphone className="size-4" />} title={t("ثبّتها على موبايلك", "Install on your phone")} />
          <p className="text-sm text-muted mt-2 leading-relaxed">
            {t(
              "من المتصفح على الموبايل: اختار «مشاركة» ← «إضافة إلى الشاشة الرئيسية»، وهتلاقي أنيس كأبليكيشن كامل بأيقونته.",
              "On mobile: tap Share → Add to Home Screen, and Anees becomes a full app with its own icon.",
            )}
          </p>
        </Card>

        {/* logout */}
        <Button variant="ghost" block onClick={logout} className="text-danger">
          <LogOut className="size-4" /> {t("تسجيل خروج", "Log out")}
        </Button>
      </div>
    </PageShell>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid place-items-center size-9 rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <h2 className="font-bold text-ink">{title}</h2>
    </div>
  );
}
