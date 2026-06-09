"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Images } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { useI18n } from "@/components/i18n";

type Photo = { id: string; url: string; tag: string | null };

// Downscale to ≤768px JPEG so the repo stays light.
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 768;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Manage her photo album — the pictures she can "send" in chat. */
export function PhotoRepo() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/assistant/photos");
      if (res.ok) setPhotos((await res.json()).photos ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        try {
          const url = await downscale(file);
          const res = await fetch("/api/assistant/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, tag: tag.trim() || undefined }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.photo) setPhotos((p) => [data.photo, ...p]);
        } catch {
          /* skip a bad file */
        }
      }
      setTag("");
      toast(t("اترفعت ✅", "Uploaded ✅"), "success");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: t("تمسح الصورة دي؟", "Delete this photo?"),
      confirmText: t("امسح", "Delete"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    await fetch("/api/assistant/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Images className="size-4 text-accent" />
        <h2 className="font-bold text-ink">{t("ألبوم صورها", "Her photo album")}</h2>
        {!loading && <span className="text-xs text-muted">({photos.length})</span>}
      </div>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        {t(
          "الصور دي اللي نورا بتختار منها وتبعتلك في الشات. ممكن تكتب وصف صغير (مود/مكان) قبل الرفع عشان تعرف تختار المناسب.",
          "These are the photos she picks from to send you. Add a short tag (mood/place) before uploading so she can pick the right one.",
        )}
      </p>

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <Input
            placeholder={t("وصف اختياري (صباح، زعلانة، خروج...)", "optional tag (morning, sad, night out...)")}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button type="button" variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" /> {t("ضيف صور", "Add photos")}
        </Button>
      </div>

      {loading ? (
        <div className="h-20 rounded-xl bg-bg border border-border animate-pulse" />
      ) : photos.length === 0 ? (
        <div className="text-sm text-muted bg-bg border border-dashed border-border rounded-xl px-4 py-6 text-center">
          {t("مفيش صور لسه — ارفع صورها هنا.", "No photos yet — upload hers here.")}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.tag ?? ""} className="size-full object-cover rounded-xl border border-border" />
              {p.tag && (
                <span className="absolute bottom-1 start-1 text-[10px] bg-overlay/70 text-white rounded px-1.5 py-0.5 max-w-[90%] truncate">
                  {p.tag}
                </span>
              )}
              <button
                onClick={() => remove(p.id)}
                aria-label={t("امسح", "Delete")}
                className="absolute top-1 end-1 size-7 grid place-items-center rounded-full bg-overlay/70 text-white active:scale-90 transition-transform"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
