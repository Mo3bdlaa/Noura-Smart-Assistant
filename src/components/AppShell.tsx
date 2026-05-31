"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Sidebar, type Conv } from "@/components/Sidebar";
import { cn } from "@/lib/cn";

type MoodKind = "happy" | "calm" | "upset";

/**
 * Responsive app shell: a persistent sidebar on desktop, and a slide-in drawer
 * (with a top app bar) on mobile.
 */
export function AppShell({
  assistantName,
  assistantPhoto,
  mood,
  moodLabel,
  isAdmin,
  conversations,
  children,
}: {
  assistantName: string;
  assistantPhoto?: string | null;
  mood: MoodKind;
  moodLabel: string;
  isAdmin: boolean;
  conversations: Conv[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-0 h-dvh flex overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          assistantName={assistantName}
          assistantPhoto={assistantPhoto}
          mood={mood}
          moodLabel={moodLabel}
          isAdmin={isAdmin}
          conversations={conversations}
        />
      </div>

      {/* Mobile drawer */}
      <div className={cn("lg:hidden fixed inset-0 z-50", open ? "" : "pointer-events-none")}>
        <div
          className={cn(
            "absolute inset-0 bg-overlay/55 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 right-0 w-[82%] max-w-xs transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <Sidebar
            assistantName={assistantName}
            assistantPhoto={assistantPhoto}
            mood={mood}
            moodLabel={moodLabel}
            isAdmin={isAdmin}
            conversations={conversations}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar — safe-area padding on the wrapper so the 56px row
            (h-14) isn't eaten by the notch inset. */}
        <header className="lg:hidden pt-safe border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 px-3 h-14">
            <IconButton onClick={() => setOpen(true)} aria-label="القائمة">
              <Menu className="size-5" />
            </IconButton>
            <Link href="/profile" className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar name={assistantName} photo={assistantPhoto} size="sm" mood={mood} />
              <div className="min-w-0">
                <div className="font-bold text-ink leading-tight truncate">{assistantName}</div>
                <div className="text-[11px] text-muted leading-tight truncate">{moodLabel}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col bg-bg">{children}</main>
      </div>

      {/* close button floating when drawer open (mobile) */}
      {open && (
        <IconButton
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
          className="lg:hidden fixed top-3 left-3 z-[55] bg-surface shadow-raised"
        >
          <X className="size-5" />
        </IconButton>
      )}
    </div>
  );
}
