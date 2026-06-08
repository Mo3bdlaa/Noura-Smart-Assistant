"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Lightweight markdown for chat bubbles. Inherits the bubble's text colour so it
 * works in both the user (on-accent) and assistant bubbles. Raw HTML is NOT
 * enabled (safe by default). Emphasis (*text*) is styled as a soft italic — this
 * doubles as the "roleplay action" look (e.g. *أخدت الموبايل بعيد*).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic opacity-80">{children}</em>,
          ul: ({ children }) => <ul className="list-disc ps-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 break-all"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="rounded-lg bg-black/10 dark:bg-white/10 p-2.5 overflow-x-auto text-[0.9em]">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-s-2 border-current/30 ps-3 opacity-90">{children}</blockquote>
          ),
          h1: ({ children }) => <p className="font-bold text-[1.05em]">{children}</p>,
          h2: ({ children }) => <p className="font-bold">{children}</p>,
          h3: ({ children }) => <p className="font-bold">{children}</p>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
