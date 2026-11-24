// Estimasi biaya per panggilan (USD) untuk log apiRuns & batas anggaran bulanan.
// 9router sendiri gratis; tagihan nyata tergantung provider/langganan di belakangnya. Angka ini dipakai
// sebagai "biaya setara" (tarif Claude Sonnet per 1 juta token) supaya batas anggaran tetap jadi pengaman.
// shortcut: tarif tetap untuk semua model 9router; ubah DEFAULT_RATES jika provider Anda punya tarif sendiri.
export const DEFAULT_RATES = { input: 2.0, output: 10.0, cacheRead: 0.1, cacheWrite: 2.5 } as const;
export const WEB_SEARCH_USD = 0.008; // per query Tavily (kuota gratis bulanan tetap dihitung, sebagai pengaman)

export type UsageCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearchCount: number;
};

export function estCostUsd(u: UsageCounts, r: typeof DEFAULT_RATES = DEFAULT_RATES): number {
  const usd =
    (u.inputTokens * r.input + u.outputTokens * r.output + u.cacheReadTokens * r.cacheRead + u.cacheWriteTokens * r.cacheWrite) /
      1_000_000 +
    u.webSearchCount * WEB_SEARCH_USD;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
