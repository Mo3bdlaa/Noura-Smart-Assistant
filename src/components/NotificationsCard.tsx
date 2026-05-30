"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsCard() {
  const toast = useToast();
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast("لازم تسمح بالإشعارات من المتصفح", "error");
        return;
      }
      const keyRes = await fetch("/api/push/public-key");
      const { key } = await keyRes.json();
      if (!key) {
        toast("الإشعارات مش متظبّطة على السيرفر", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        toast("مش قادر يفعّل الإشعارات", "error");
        return;
      }
      setSubscribed(true);
      toast("الإشعارات اتفعّلت ✅", "success");
    } catch {
      toast("حصل خطأ في تفعيل الإشعارات", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "مش قادر يبعت", "error");
        return;
      }
      toast("بعتتلك إشعار 🔔", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center size-9 rounded-xl bg-accent-soft text-accent">
          <BellRing className="size-4" />
        </span>
        <h2 className="font-bold text-ink">الإشعارات على الموبايل</h2>
      </div>

      {!supported ? (
        <p className="text-sm text-muted mt-3 leading-relaxed">
          متصفحك مش بيدعم الإشعارات. على الآيفون لازم تضيف نورا للشاشة الرئيسية الأول، وبعدين تفعّلها
          من هنا.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            فعّل الإشعارات عشان نورا تقدر تبعتلك تذكيراتك وتطمن عليك حتى لو التطبيق مقفول.
          </p>
          <div className="flex gap-2 mt-4">
            {!subscribed ? (
              <Button onClick={enable} loading={busy}>
                <Bell className="size-4" /> فعّل الإشعارات
              </Button>
            ) : (
              <Button variant="outline" onClick={test} loading={busy}>
                <Send className="size-4" /> ابعت إشعار تجريبي
              </Button>
            )}
          </div>
          {subscribed && (
            <p className="text-xs text-success mt-2">الإشعارات مفعّلة على الجهاز ده ✅</p>
          )}
        </>
      )}
    </Card>
  );
}
