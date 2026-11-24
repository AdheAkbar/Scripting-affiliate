// Ambil link produk dari parameter Web Share Target.
// Aplikasi marketplace sering menaruh link di `text` (mis. "Cek produk ini! https://...") dan mengosongkan `url`.
export function extractSharedUrl(params: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  for (const candidate of [params.url, params.text, params.title]) {
    if (!candidate) continue;
    const match = candidate.match(/https?:\/\/[^\s"'<>]+/i);
    if (match) return match[0].replace(/[.,!?)\]]+$/, "");
  }
  return null;
}
