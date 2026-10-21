"use client";

import dynamic from "next/dynamic";

// The Markdown engine (react-markdown + remark) is ~150 KB. Only the chat and the assistant need it, so it is
// fetched the first time an answer is shown instead of on every page load.
const Renderer = dynamic(() => import("./MarkdownRenderer").then((m) => m.MarkdownRenderer), {
  ssr: false,
  loading: () => <div className="vertex-md whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">…</div>,
});

/** Renders an assistant answer: headings, lists, tables, code and links — never raw HTML. */
export function Markdown({ children }: { children: string }) {
  return <Renderer>{children}</Renderer>;
}
