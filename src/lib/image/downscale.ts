/**
 * Client-side image downscaling — the single implementation used by every upload
 * path (chat attachments, her photo album, avatar). Keeping one copy means the size
 * and quality rules can't silently drift apart per surface.
 */
export type DownscaleOpts = { maxDim?: number; quality?: number };

export function downscaleImage(file: File, opts: DownscaleOpts = {}): Promise<string> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.82;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("could not read image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Presets per surface (kept here so the numbers live in one place). */
export const DOWNSCALE = {
  chatAttachment: { maxDim: 1024, quality: 0.82 },
  albumPhoto: { maxDim: 768, quality: 0.82 },
  avatar: { maxDim: 512, quality: 0.85 },
} as const;
