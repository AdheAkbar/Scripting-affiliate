import { describe, expect, it } from "vitest";
import {
  calculateMeasuredWpm,
  estimateScriptDurationLabel,
  getReadingWords,
  WPM_MAX,
  WPM_MIN,
} from "./wpm-test";

describe("wpm-test", () => {
  it("naskah uji baca cukup untuk 30 detik", () => {
    const n = getReadingWords().length;
    expect(n).toBeGreaterThanOrEqual(70);
    expect(n).toBeLessThanOrEqual(120);
  });

  it("menghitung WPM dan clamp ke 110–180", () => {
    expect(calculateMeasuredWpm(70, 30)).toEqual({ rawWpm: 140, clampedWpm: 140, wasClamped: false });
    expect(calculateMeasuredWpm(45, 30)).toEqual({ rawWpm: 90, clampedWpm: WPM_MIN, wasClamped: true });
    expect(calculateMeasuredWpm(105, 30)).toEqual({ rawWpm: 210, clampedWpm: WPM_MAX, wasClamped: true });
    expect(calculateMeasuredWpm(0, 30)).toEqual({ rawWpm: 0, clampedWpm: 140, wasClamped: true });
  });

  it("memformat estimasi durasi", () => {
    expect(estimateScriptDurationLabel("satu dua tiga empat lima enam tujuh", 140)).toBe("3 dtk · 7 kata @140 WPM");
  });
});
