// Ambil kalimat VO yang sudah tertulis dari JSON naskah yang masih setengah jadi (stream),
// supaya adegan bisa tampil satu per satu sebelum JSON lengkap.
const VO_RE = /"voiceoverText"\s*:\s*"((?:[^"\\]|\\.)*)("?)/g;
const ROLE_RE = /"role"\s*:\s*"([a-z_]+)"/g;

function unescape(s: string): string {
  try {
    return JSON.parse(`"${s.replace(/\\$/, "")}"`) as string;
  } catch {
    return s.replace(/\\n/g, " ").replace(/\\"/g, '"');
  }
}

export type PreviewScene = { role?: string; text: string; done: boolean };

/** Hanya voiceoverText level adegan (bukan di dalam ctaVariants) yang dihitung. */
export function previewScenes(partialJson: string): PreviewScene[] {
  const roles = [...partialJson.matchAll(ROLE_RE)].map((m) => ({ at: m.index ?? 0, role: m[1] }));
  const out: PreviewScene[] = [];
  for (const m of partialJson.matchAll(VO_RE)) {
    const at = m.index ?? 0;
    const before = partialJson.slice(Math.max(0, at - 400), at);
    if (/"ctaVariants"\s*:\s*\{[^}]*$/.test(before) || /"(tiktok|shopee|reels|shorts)"\s*:\s*\{\s*$/.test(before)) continue;
    const role = [...roles].reverse().find((r) => r.at < at)?.role;
    out.push({ role, text: unescape(m[1] ?? ""), done: m[2] === '"' });
  }
  return out;
}
