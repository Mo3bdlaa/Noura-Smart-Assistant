"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Full-screen shell for standalone pages (memories, settings, admin). */
export function PageShell({
  title,
  icon,
  backHref = "/chat",
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border pt-safe">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link
            href={backHref}
            className="inline-flex items-center justify-center size-9 rounded-full text-muted hover:text-ink hover:bg-elevated transition-theme"
            aria-label="رجوع"
          >
            <ArrowRight className="size-5" />
          </Link>
          {icon && <span className="text-accent">{icon}</span>}
          <h1 className="text-lg font-bold text-ink">{title}</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">{children}</main>
    </div>
  );
}
