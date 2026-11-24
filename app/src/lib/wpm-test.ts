import { countWords } from "../../shared/duration";

export const WPM_MIN = 110;
export const WPM_MAX = 180;
export const READING_TEST_SECONDS = 30;

// Naskah contoh ~90 kata untuk uji baca 30 detik (mencakup rentang 110–180 WPM secara alami).
export const READING_TEST_SCRIPT =
  "Kalau kamu sering bingung pilih sunscreen yang nggak bikin wajah kelihatan abu-abu, coba perhatikan tekstur cair yang cepat meresap ini. Aku sudah pakai hampir dua minggu setiap pagi sebelum berangkat kerja. Di kulit kombinasi, hasilnya tetap ringan dan nggak bikin bedak geser walau dipakai di luar ruangan. Memang botolnya agak kecil buat pemakaian rutin, jadi perlu sedia cadangan kalau lagi sering aktivitas di luar. Kalau mau cek varian yang cocok sama jenis kulitmu, langsung lihat detail produknya sekarang.";

export function getReadingWords(): string[] {
  return READING_TEST_SCRIPT.trim().split(/\s+/).filter(Boolean);
}

export function calculateMeasuredWpm(wordsRead: number, elapsedSeconds: number): {
  rawWpm: number;
  clampedWpm: number;
  wasClamped: boolean;
} {
  if (wordsRead <= 0 || elapsedSeconds <= 0) {
    return { rawWpm: 0, clampedWpm: 140, wasClamped: true };
  }
  const rawWpm = Math.round((wordsRead / elapsedSeconds) * 60);
  const clampedWpm = Math.min(WPM_MAX, Math.max(WPM_MIN, rawWpm));
  return {
    rawWpm,
    clampedWpm,
    wasClamped: rawWpm !== clampedWpm,
  };
}

export function estimateScriptDurationLabel(sampleText: string, wpm: number): string {
  const words = countWords(sampleText);
  const sec = Math.round((words / wpm) * 60 * 10) / 10;
  return `${sec} dtk · ${words} kata @${wpm} WPM`;
}
