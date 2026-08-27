import type { NativeOfflineSubtitleV1 } from '../downloads/nativeDownloadEngine';

export interface OfflineSubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

const MAX_CUES = 20_000;
const MAX_CUE_TEXT = 600;
const MAX_TIMELINE_SECONDS = 30 * 24 * 60 * 60;

function clockSeconds(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && hours >= 0 && minutes >= 0 && minutes < 60
    && seconds >= 0 && seconds < 60 && total <= MAX_TIMELINE_SECONDS ? total : null;
}

function cueText(value: string): string {
  return value
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\\N|\\n/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_CUE_TEXT);
}

function appendCue(cues: OfflineSubtitleCue[], start: number | null, end: number | null, text: string) {
  if (cues.length >= MAX_CUES || start === null || end === null || end <= start) return;
  const clean = cueText(text);
  if (clean) cues.push({ startSeconds: start, endSeconds: end, text: clean });
}

function parseBlockCues(content: string): OfflineSubtitleCue[] {
  const cues: OfflineSubtitleCue[] = [];
  const blocks = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const timing = /(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{2,3})\s*-->\s*(\d{1,3}:\d{2}(?::\d{2})?[.,]\d{2,3})/;
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => timing.test(line));
    if (timingIndex < 0) continue;
    const match = lines[timingIndex].match(timing);
    appendCue(cues, clockSeconds(match?.[1] || ''), clockSeconds(match?.[2] || ''), lines.slice(timingIndex + 1).join('\n'));
    if (cues.length >= MAX_CUES) break;
  }
  return cues;
}

function splitAssDialogue(value: string, fieldCount: number): string[] {
  const fields: string[] = [];
  let rest = value;
  for (let index = 1; index < fieldCount; index += 1) {
    const separator = rest.indexOf(',');
    if (separator < 0) break;
    fields.push(rest.slice(0, separator));
    rest = rest.slice(separator + 1);
  }
  fields.push(rest);
  return fields;
}

function parseAssCues(content: string): OfflineSubtitleCue[] {
  const cues: OfflineSubtitleCue[] = [];
  let inEvents = false;
  let fields = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  for (const raw of content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (/^\[events\]$/i.test(line)) { inEvents = true; continue; }
    if (/^\[/.test(line)) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (/^format\s*:/i.test(line)) {
      fields = line.slice(line.indexOf(':') + 1).split(',').map((field) => field.trim().toLowerCase());
      continue;
    }
    if (!/^dialogue\s*:/i.test(line)) continue;
    const values = splitAssDialogue(line.slice(line.indexOf(':') + 1).trim(), fields.length);
    const startIndex = fields.indexOf('start');
    const endIndex = fields.indexOf('end');
    const textIndex = fields.indexOf('text');
    if (startIndex < 0 || endIndex < 0 || textIndex < 0) continue;
    appendCue(cues, clockSeconds(values[startIndex] || ''), clockSeconds(values[endIndex] || ''), values[textIndex] || '');
    if (cues.length >= MAX_CUES) break;
  }
  return cues;
}

export function parseOfflineSubtitleCues(subtitle: NativeOfflineSubtitleV1): OfflineSubtitleCue[] {
  const cues = subtitle.format === 'ass' ? parseAssCues(subtitle.content) : parseBlockCues(subtitle.content);
  return cues.sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds);
}

export function activeOfflineSubtitleCue(cues: readonly OfflineSubtitleCue[], currentTime: number): OfflineSubtitleCue | null {
  if (!Number.isFinite(currentTime) || currentTime < 0 || cues.length === 0) return null;
  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (cues[middle].startSeconds <= currentTime) { candidate = middle; low = middle + 1; }
    else high = middle - 1;
  }
  for (let index = candidate; index >= 0 && cues[index].startSeconds <= currentTime; index -= 1) {
    if (currentTime < cues[index].endSeconds) return cues[index];
    if (candidate - index > 8) break;
  }
  return null;
}
