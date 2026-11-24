// Estimasi durasi voiceover dari jumlah kata & WPM brand (prd.md F-08, design.md Duration Pill).
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateSeconds(text: string, wpm: number): number {
  if (wpm <= 0) throw new Error("wpm harus > 0");
  return Math.round((countWords(text) / wpm) * 60 * 10) / 10;
}

// Monthkey anggaran memakai zona Asia/Jakarta, bukan UTC (erd.md apiRuns.monthKey).
export function monthKeyJakarta(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}
