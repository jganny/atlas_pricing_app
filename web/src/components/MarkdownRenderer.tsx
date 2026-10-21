"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders an assistant answer: headings, lists, tables, code and links — never raw HTML. */
export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="vertex-md text-sm leading-relaxed text-[var(--color-text)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: c, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="font-semibold text-sky-800 underline">
              {c}
            </a>
          ),
          table: ({ children: c }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full border-collapse text-xs">{c}</table>
            </div>
          ),
          th: ({ children: c }) => <th className="border-b border-[var(--color-border)] bg-slate-50 px-2 py-1.5 text-left font-bold">{c}</th>,
          td: ({ children: c }) => <td className="border-b border-[var(--color-border)] px-2 py-1.5 align-top">{c}</td>,
          p: ({ children: c }) => <p className="my-1.5">{c}</p>,
          ul: ({ children: c }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{c}</ul>,
          ol: ({ children: c }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{c}</ol>,
          h1: ({ children: c }) => <h3 className="mb-1 mt-3 text-base font-extrabold">{c}</h3>,
          h2: ({ children: c }) => <h3 className="mb-1 mt-3 text-base font-extrabold">{c}</h3>,
          h3: ({ children: c }) => <h4 className="mb-1 mt-2 text-sm font-extrabold">{c}</h4>,
          code: ({ children: c, className }) =>
            className ? (
              <code className={`${className} block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100`}>{c}</code>
            ) : (
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">{c}</code>
            ),
          pre: ({ children: c }) => <pre className="my-2">{c}</pre>,
          blockquote: ({ children: c }) => <blockquote className="my-2 border-l-4 border-slate-200 pl-3 text-[var(--color-text-muted)]">{c}</blockquote>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
