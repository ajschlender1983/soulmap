"use client";

import { Fragment, type ReactNode } from "react";

/** A small markdown renderer for the two report files: headings, lists, quotes, bold/italic/code, rules. */

export type Section = { id: string; title: string; level: number; start: number };

export function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60); }

export function sections(md: string): Section[] {
  const out: Section[] = [];
  md.split("\n").forEach((line, i) => {
    const m = line.match(/^(#{1,3})\s+(.*)/);
    if (m) out.push({ id: slug(m[2]), title: m[2].replace(/^\d+\.\s*/, ""), level: m[1].length, start: i });
  });
  return out;
}

function inline(text: string, key = 0): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={`${key}-${i++}`}>{t.slice(1, -1)}</code>);
    else parts.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ md }: { md: string }) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const Tag = (`h${h[1].length}`) as "h1" | "h2" | "h3";
      out.push(<Tag key={k++} id={slug(h[2])}>{inline(h[2], k)}</Tag>);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { out.push(<hr key={k++} />); i++; continue; }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i].replace(/^>\s?/, "")), i++;
      out.push(<blockquote key={k++}>{inline(buf.join(" "), k)}</blockquote>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) items[items.length - 1] += " " + lines[i].trim(), i++; }
      out.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t, k * 100 + j)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) items[items.length - 1] += " " + lines[i].trim(), i++; }
      out.push(<ol key={k++}>{items.map((t, j) => <li key={j}>{inline(t, k * 100 + j)}</li>)}</ol>);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) { const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim()); if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells); i++; }
      out.push(
        <div key={k++} className="mb-4 overflow-x-auto"><table className="t-small w-full border-collapse">
          <tbody>{rows.map((r, ri) => <tr key={ri} className="border-b border-[var(--color-line)]">{r.map((c, ci) => ri === 0 ? <th key={ci} className="py-2 pr-3 text-left font-medium">{inline(c, k)}</th> : <td key={ci} className="py-2 pr-3 align-top">{inline(c, k)}</td>)}</tr>)}</tbody>
        </table></div>,
      );
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s+|\s*\d+[.)]\s+|\|)/.test(lines[i]) && !/^(-{3,}|\*{3,})$/.test(lines[i].trim())) buf.push(lines[i].trim()), i++;
    out.push(<p key={k++}>{buf.map((t, j) => <Fragment key={j}>{inline(t, k * 100 + j)}{j < buf.length - 1 ? " " : null}</Fragment>)}</p>);
  }
  return <div className="prose">{out}</div>;
}
