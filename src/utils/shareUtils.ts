// src/utils/shareUtils.ts
import { deflateRaw, inflateRaw } from 'pako';
import { SavedSection } from '../types';

const SHARE_VERSION = 'v1';

// Fields to strip from sections before encoding (regenerated on import)
type StrippedSection = Omit<SavedSection, 'id' | 'timestamp'>;

export function encodeSections(sections: SavedSection[]): string {
  const stripped: StrippedSection[] = sections.map(({ id, timestamp, ...rest }) => rest);
  const json = JSON.stringify(stripped);
  const compressed = deflateRaw(new TextEncoder().encode(json));

  // Convert Uint8Array to base64
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  const base64 = btoa(binary);

  return `${SHARE_VERSION}:${base64}`;
}

export function decodeSections(hash: string): SavedSection[] | null {
  try {
    if (!hash.startsWith(`${SHARE_VERSION}:`)) return null;

    const base64 = hash.slice(SHARE_VERSION.length + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decompressed = inflateRaw(bytes);
    const json = new TextDecoder().decode(decompressed);
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) return null;

    const now = Date.now();
    const sections: SavedSection[] = parsed
      .filter((item: any) =>
        typeof item.name === 'string' &&
        typeof item.lectureUnits === 'number' &&
        Array.isArray(item.lectureDays) &&
        typeof item.selectedTermId === 'string'
      )
      .map((item: any, index: number) => ({
        ...item,
        id: (now + index).toString(),
        timestamp: now
      }));

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

export function generateShareUrl(sections: SavedSection[]): string {
  const encoded = encodeSections(sections);
  return `${window.location.origin}${window.location.pathname}#${encoded}`;
}
