export type InlineNote = { text: string; emphasis?: boolean; href?: string };
export type NoteBlock = { kind: 'heading' | 'paragraph' | 'bullet'; level?: number; parts: InlineNote[] };
export interface ReleaseDocument { version: string; title: string; notes: string }
export const NOTE_LIMIT = 48_000;
// The existing mobile external-link path uses Linking.openURL. Only HTTPS public
// destinations are handed to it; HTML, credentials and local addresses are rejected.
export function safeNoteLink(value: string): string | undefined {
  try {
    if (value.length > 2048 || /[\s\\\u0000-\u001f]/.test(value)) return;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return;
    if (!host.includes('.') || host === 'localhost' || /(?:^|\.)(?:local|internal)$/.test(host) || /^[\d.]+$/.test(host) || host.includes(':')) return;
    return url.href;
  } catch { return; }
}
export function parseInlineNotes(value: string): InlineNote[] {
  const clean = value.replace(/<[^>]*>/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  const result: InlineNote[] = [];
  const pattern = /\[([^\]\n]{1,400})\]\(([^)\n]{1,2048})\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|`([^`\n]+)`/g;
  let start = 0;
  for (const match of clean.matchAll(pattern)) {
    if (match.index! > start) result.push({ text: clean.slice(start, match.index) });
    result.push(match[1] ? { text: match[1], href: safeNoteLink(match[2]) } : { text: match[3] || match[4] || match[5] || match[6], emphasis: true });
    start = match.index! + match[0].length;
    if (result.length > 160) break;
  }
  if (start < clean.length) result.push({ text: clean.slice(start) });
  return result;
}
export function parseReleaseNotes(value: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) blocks.push({ kind: 'paragraph', parts: parseInlineNotes(paragraph.join(' ')) }); paragraph = []; };
  let fenced = false;
  for (const raw of value.slice(0, NOTE_LIMIT).replace(/\r/g, '').split('\n').slice(0, 500)) {
    const line = raw.trim();
    if (/^```/.test(line)) { flush(); fenced = !fenced; continue; }
    if (fenced) continue;
    if (!line || /^([-*_])\1{2,}$/.test(line)) { flush(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (heading || bullet) { flush(); blocks.push(heading ? { kind: 'heading', level: heading[1].length, parts: parseInlineNotes(heading[2]) } : { kind: 'bullet', parts: parseInlineNotes(bullet![1]) }); }
    else paragraph.push(line.replace(/^>\s*/, ''));
  }
  flush(); return blocks.filter(block => block.parts.some(part => part.text.trim()));
}
