"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Lock, Settings, Smartphone, User } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";

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
}: {
  isAdmin: boolean;
  initial: { displayName: string; timezone: string; assistantName: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [profile, setProfile] = useState(initial);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [savingPw, setSavingPw] = useState(false);

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
        toast(data.error ?? "مش قادر أحفظ", "error");
        return;
      }
      toast("اتحفظ ✅", "success");
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
        toast(data.error ?? "مش قادر أغيّر الباسورد", "error");
        return;
      }
      toast("الباسورد اتغيّر ✅", "success");
      setPw({ currentPassword: "", newPassword: "" });
    } finally {
      setSavingPw(false);
    }
  }

  async function logout() {
    const ok = await confirm({ title: "تسجيل خروج؟", confirmText: "خروج" });
    if (!ok) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <PageShell title="الإعدادات" icon={<Settings className="size-5" />}>
      <div className="space-y-5">
        {/* profile */}
        <Card className="p-5">
          <SectionTitle icon={<User className="size-4" />} title="حسابك ومساعدتك" />
          <form onSubmit={saveProfile} className="space-y-4 mt-4">
            <Field label="اسمك">
              <Input
                value={profile.displayName}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
              />
            </Field>
            <Field
              label="اسم مساعدتك"
              hint={isAdmin ? 'إنت أدمن — تقدر تسميها "نورا"' : 'أي اسم (مش "نورا")'}
            >
              <Input
                value={profile.assistantName}
                onChange={(e) => setProfile((p) => ({ ...p, assistantName: e.target.value }))}
              />
            </Field>
            <Field label="المنطقة الزمنية" hint="عشان تحس بالوقت بتاعك صح">
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
              حفظ
            </Button>
          </form>
        </Card>

        {/* password */}
        <Card className="p-5">
          <SectionTitle icon={<Lock className="size-4" />} title="تغيير الباسورد" />
          <form onSubmit={savePassword} className="space-y-4 mt-4">
            <Field label="الباسورد الحالي">
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </Field>
            <Field label="الباسورد الجديد" hint="٨ حروف على الأقل">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </Field>
            <Button type="submit" variant="outline" loading={savingPw}>
              تغيير
            </Button>
          </form>
        </Card>

        {/* install hint */}
        <Card className="p-5">
          <SectionTitle icon={<Smartphone className="size-4" />} title="ثبّتها على موبايلك" />
          <p className="text-sm text-muted mt-2 leading-relaxed">
            من المتصفح على الموبايل: اختار <b>مشاركة</b> → <b>إضافة إلى الشاشة الرئيسية</b>، وهتلاقي
            نورا كأبليكيشن كامل بأيقونتها.
          </p>
        </Card>

        {/* logout */}
        <Button variant="ghost" block onClick={logout} className="text-danger">
          <LogOut className="size-4" /> تسجيل خروج
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
