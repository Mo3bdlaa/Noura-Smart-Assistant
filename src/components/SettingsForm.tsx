"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Cpu, Languages, LogOut, Lock, Moon, Palette, Settings, Smartphone, Sun, SunMoon, User } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { NotificationsCard } from "@/components/NotificationsCard";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { GEMINI_VOICE_OPTIONS, DEFAULT_GEMINI_VOICE } from "@/lib/voice/gemini-voices";
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
  initial: {
    displayName: string;
    timezone: string;
    assistantName: string;
    appearance: string;
    voiceId: string;
    playfulness: number;
    bluntness: number;
    warmth: number;
  };
  provider?: {
    baseUrl: string;
    chatModel: string;
    utilityModel: string;
    embedModel: string;
    keyCount: number;
    voiceId?: string;
  } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { locale, setLocale, t } = useI18n();

  const [theme, setThemeState] = useState<"auto" | "light" | "dark">("auto");
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )theme=(\w+)/);
    setThemeState(m?.[1] === "light" || m?.[1] === "dark" ? (m[1] as "light" | "dark") : "auto");
  }, []);
  function setTheme(p: "auto" | "light" | "dark") {
    document.cookie = `theme=${p}; path=/; max-age=31536000; samesite=lax`;
    setThemeState(p);
    router.refresh();
  }

  const [profile, setProfile] = useState(initial);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [prov, setProv] = useState({
    baseUrl: provider?.baseUrl ?? "",
    apiKeys: "",
    chatModel: provider?.chatModel ?? "",
    utilityModel: provider?.utilityModel ?? "",
    embedModel: provider?.embedModel ?? "",
    voiceId: provider?.voiceId ?? "",
    chatBase: "",
    chatKeys: "",
    utilBase: "",
    utilKeys: "",
    embBase: "",
    embKeys: "",
  });
  const [adv, setAdv] = useState(false);
  const [savingProv, setSavingProv] = useState(false);

  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    setSavingProv(true);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: prov.baseUrl,
          apiKeys: prov.apiKeys,
          chatModel: prov.chatModel,
          utilityModel: prov.utilityModel,
          embedModel: prov.embedModel,
          voiceId: prov.voiceId,
          chat: { baseUrl: prov.chatBase, apiKeys: prov.chatKeys },
          utility: { baseUrl: prov.utilBase, apiKeys: prov.utilKeys },
          embed: { baseUrl: prov.embBase, apiKeys: prov.embKeys },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أحفظ", "Couldn't save"), "error");
        return;
      }
      toast(t("إعدادات المزوّد اتحفظت ✅", "Provider settings saved ✅"), "success");
      setProv((p) => ({ ...p, apiKeys: "" }));
      router.refresh();
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
        body: JSON.stringify({
          displayName: profile.displayName,
          timezone: profile.timezone,
          assistantName: profile.assistantName,
          appearance: profile.appearance,
          voiceId: profile.voiceId,
          dials: {
            playfulness: profile.playfulness,
            bluntness: profile.bluntness,
            warmth: profile.warmth,
          },
        }),
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

        {/* appearance */}
        <Card className="p-5">
          <SectionTitle icon={<Palette className="size-4" />} title={t("المظهر", "Appearance")} />
          <div className="grid grid-cols-3 gap-2 mt-4">
            {([
              ["auto", <SunMoon key="a" className="size-4" />, t("تلقائي", "Auto")],
              ["light", <Sun key="l" className="size-4" />, t("فاتح", "Light")],
              ["dark", <Moon key="d" className="size-4" />, t("داكن", "Dark")],
            ] as const).map(([val, icon, label]) => (
              <button
                key={val}
                onClick={() => setTheme(val)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-medium transition-theme border",
                  theme === val
                    ? "bg-accent-soft text-accent border-accent/30"
                    : "bg-elevated text-muted border-transparent hover:text-ink",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint mt-2">
            {t("«تلقائي» بيتبع وقت اليوم (داكن بالليل).", "“Auto” follows the time of day (dark at night).")}
          </p>
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
            <Field
              label={t("شكلها (للوصف وتوليد الصور)", "Her looks (for self-description & image gen)")}
              hint={t("اوصف شكلها بإيجاز — بتستخدمه لما توصف نفسها أو تبعت/تولّد صورة.", "Briefly describe her — used when she describes herself or sends/generates a photo.")}
            >
              <Textarea
                rows={2}
                placeholder={t("مثلاً: بنت مصرية، شعر بني مموج، عيون خضرا، ابتسامة دافية...", "e.g. Egyptian woman, wavy brown hair, green eyes, warm smile...")}
                value={profile.appearance}
                onChange={(e) => setProfile((p) => ({ ...p, appearance: e.target.value }))}
              />
            </Field>
            <Field label={t("صوتها", "Her voice")} hint={t("صوت Gemini اللي بتتكلم بيه", "the Gemini voice she speaks with")}>
              <select
                value={profile.voiceId || DEFAULT_GEMINI_VOICE}
                onChange={(e) => setProfile((p) => ({ ...p, voiceId: e.target.value }))}
                className="w-full h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme"
              >
                {GEMINI_VOICE_OPTIONS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} — {t(v.ar, v.en)}
                  </option>
                ))}
              </select>
            </Field>

            {/* personality dials */}
            <div className="space-y-3 pt-1">
              <div className="text-sm font-medium text-ink">{t("معايرة شخصيتها", "Her personality")}</div>
              {(
                [
                  ["playfulness", t("الهزار والدلع", "Playfulness")],
                  ["bluntness", t("الصراحة والـ push back", "Bluntness")],
                  ["warmth", t("الحنية", "Warmth")],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span>{label}</span>
                    <span>{Math.round((profile[key] as number) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={profile[key] as number}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="w-full accent-accent"
                  />
                </div>
              ))}
            </div>

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
              {t(
                "أي مزوّد متوافق مع OpenAI (Gemini الافتراضي، أو OpenAI / Groq / OpenRouter / Ollama محلي...).",
                "Any OpenAI-compatible provider (Gemini by default, or OpenAI / Groq / OpenRouter / local Ollama...).",
              )}
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
              <div className="rounded-xl border border-border p-3">
                <ApiKeyManager />
              </div>
              <Field
                label={t("موديل الشات", "Chat model")}
                hint={t("الجودة الأعلى للرد", "highest quality for replies")}
              >
                <Input
                  dir="ltr"
                  placeholder="gemini-2.5-flash"
                  value={prov.chatModel}
                  onChange={(e) => setProv((p) => ({ ...p, chatModel: e.target.value }))}
                />
              </Field>
              <Field
                label={t("موديل الأدوات (utility)", "Utility model")}
                hint={t("للعنوان/التحليل/المهام — أخف وأرخص", "titles/analysis/tasks — lighter & cheaper")}
              >
                <Input
                  dir="ltr"
                  placeholder="gemini-2.5-flash-lite"
                  value={prov.utilityModel}
                  onChange={(e) => setProv((p) => ({ ...p, utilityModel: e.target.value }))}
                />
              </Field>
              <Field label={t("موديل الـ Embeddings", "Embeddings model")} hint={t("لازم يدعم 768 بُعد", "must support 768 dims")}>
                <Input
                  dir="ltr"
                  placeholder="gemini-embedding-001"
                  value={prov.embedModel}
                  onChange={(e) => setProv((p) => ({ ...p, embedModel: e.target.value }))}
                />
              </Field>
              <div className="rounded-2xl border border-border bg-bg/40 p-3">
                <ApiKeyManager
                  endpoint="/api/settings/provider/voice-keys"
                  title={t("مفاتيح الصوت (ElevenLabs)", "Voice keys (ElevenLabs)")}
                  hint={t(
                    "بتتبدّل وتبرّد اللي يوصل حده — كل حساب مجاني بيزوّد الكوتا.",
                    "Rotated with cooldown — each free account adds quota.",
                  )}
                  placeholder="sk_..."
                />
              </div>
              <Field label={t("Voice ID العام (اختياري)", "Default Voice ID (optional)")} hint={t("صوت افتراضي لو المساعد مالوش صوت خاص", "default when an assistant has no own voice")}>
                <Input
                  dir="ltr"
                  placeholder="21m00Tcm4TlvDq8ikWAM"
                  value={prov.voiceId}
                  onChange={(e) => setProv((p) => ({ ...p, voiceId: e.target.value }))}
                />
              </Field>
              <div className="rounded-2xl border border-border bg-bg/40 p-3">
                <ApiKeyManager
                  endpoint="/api/settings/provider/image-keys"
                  title={t("توكنات توليد الصور (Pollinations)", "Image-gen tokens (Pollinations)")}
                  hint={t(
                    "توكن مجاني من enter.pollinations.ai عشان توليد صورها يبقى موثوق.",
                    "Free token from enter.pollinations.ai for reliable selfie generation.",
                  )}
                  placeholder="token..."
                />
              </div>
              {/* per-role overrides */}
              <button
                type="button"
                onClick={() => setAdv((a) => !a)}
                className="text-sm font-medium text-accent"
              >
                {adv ? "▾ " : "▸ "}
                {t("متقدّم: provider/مفاتيح لكل موديل", "Advanced: per-model provider/keys")}
              </button>
              {adv && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-xs text-muted">
                    {t(
                      "سيب أي خانة فاضية عشان تستعمل العام. مثلاً الشات Gemini والأدوات OpenRouter.",
                      "Leave any field empty to use the global one. e.g. chat on Gemini, utility on OpenRouter.",
                    )}
                  </p>
                  {(
                    [
                      ["chat", t("الشات", "Chat"), "chatBase", "chatKeys"],
                      ["utility", t("الأدوات", "Utility"), "utilBase", "utilKeys"],
                      ["embed", "Embeddings", "embBase", "embKeys"],
                    ] as const
                  ).map(([key, label, baseK, keysK]) => (
                    <div key={key} className="rounded-xl bg-bg border border-border p-3 space-y-2">
                      <div className="text-sm font-semibold text-ink">{label}</div>
                      <Input
                        dir="ltr"
                        placeholder={t("Base URL — نفس العام", "Base URL — same as global")}
                        value={prov[baseK]}
                        onChange={(e) => setProv((p) => ({ ...p, [baseK]: e.target.value }))}
                      />
                      <Textarea
                        dir="ltr"
                        rows={2}
                        placeholder={t("مفاتيح — نفس العام", "keys — same as global")}
                        value={prov[keysK]}
                        onChange={(e) => setProv((p) => ({ ...p, [keysK]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" variant="outline" loading={savingProv}>
                {t("حفظ المزوّد", "Save provider")}
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
