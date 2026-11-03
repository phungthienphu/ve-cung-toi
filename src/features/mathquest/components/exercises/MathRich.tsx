"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo } from "react";

// Text with $…$ maths, the way the AI writes exercises: plain parts stay
// React text (escaped), maths goes through KaTeX. Line breaks are kept, for
// "a) … b) …" on their own lines.

const rendered = new Map<string, string>();

function toHtml(tex: string, display: boolean) {
  const cacheKey = `${display ? "D" : "I"}${tex}`;
  let html = rendered.get(cacheKey);
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "html" });
    rendered.set(cacheKey, html);
  }
  return html;
}

const MATH = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function MathRich({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const result: { tex: string | null; display: boolean; text: string }[] = [];
    let last = 0;
    for (const match of text.matchAll(MATH)) {
      if (match.index > last) result.push({ tex: null, display: false, text: text.slice(last, match.index) });
      result.push({ tex: match[1] ?? match[2], display: match[1] !== undefined, text: match[0] });
      last = match.index + match[0].length;
    }
    if (last < text.length) result.push({ tex: null, display: false, text: text.slice(last) });
    return result;
  }, [text]);

  return (
    <span className={`whitespace-pre-line [&_.katex]:text-[1.06em] ${className}`}>
      {parts.map((part, index) =>
        part.tex === null ? <Fragment key={index}>{part.text}</Fragment> : <span key={index} dangerouslySetInnerHTML={{ __html: toHtml(part.tex, part.display) }} />,
      )}
    </span>
  );
}
