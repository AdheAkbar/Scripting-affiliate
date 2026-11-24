// Skor performa & winning patterns (prd.md §2 [5], F-14). Dihitung server, bukan client (lihat firestore.rules).

export type PerfInput = { views?: number; unitsSold?: number; productClicks?: number };

/** Terjual per 1.000 views. Jika belum ada data terjual, pakai klik produk ÷ 10 sebagai proxy. */
export function performanceScore(log: PerfInput): number {
  if (!log.views) return 0;
  const signal = log.unitsSold ?? (log.productClicks !== undefined ? log.productClicks / 10 : 0);
  return Math.round((signal / log.views) * 1000 * 100) / 100;
}

/** Tandai top 20% (dibulatkan ke atas) sebagai winning. Butuh ≥ 5 log berskor > 0 agar tidak menyesatkan. */
export function markWinning<T extends { id: string; score: number }>(logs: T[], minLogs = 5): Set<string> {
  const scored = logs.filter((l) => l.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length < minLogs) return new Set();
  return new Set(scored.slice(0, Math.ceil(scored.length * 0.2)).map((l) => l.id));
}

export type WinningScript = {
  hookType: string;
  videoFormat: string;
  sellingStyle: string;
  category: string;
  totalEstSec: number;
};

/** Ringkasan teks untuk blok <winning_patterns> di prompt Angle & Hook. Kosong jika belum ada data. */
export function summarizeWinningPatterns(wins: WinningScript[]): string {
  if (wins.length === 0) return "";
  const top = (key: keyof WinningScript) => {
    const counts = new Map<string, number>();
    for (const w of wins) counts.set(String(w[key]), (counts.get(String(w[key])) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${k} (${n}x)`)
      .join(", ");
  };
  const avgSec = Math.round(wins.reduce((s, w) => s + w.totalEstSec, 0) / wins.length);
  return [
    `Berdasarkan ${wins.length} script winning di akun ini:`,
    `- Tipe hook: ${top("hookType")}`,
    `- Format video: ${top("videoFormat")}`,
    `- Gaya jual: ${top("sellingStyle")}`,
    `- Kategori: ${top("category")}`,
    `- Rata-rata durasi: ${avgSec} detik`,
  ].join("\n");
}
