import { describe, expect, it } from "vitest";
import { previewScenes } from "./stream-preview";

describe("previewScenes", () => {
  it("menangkap adegan lengkap dan yang masih ditulis", () => {
    const partial =
      '{"scenes":[{"order":1,"role":"hook","durationSec":3,"voiceoverText":"Bibir hitam? \\"Serius\\" deh"},{"order":2,"role":"agitate","voiceoverText":"Punya pasangan tapi kayak sin';
    expect(previewScenes(partial)).toEqual([
      { role: "hook", text: 'Bibir hitam? "Serius" deh', done: true },
      { role: "agitate", text: "Punya pasangan tapi kayak sin", done: false },
    ]);
  });

  it("mengabaikan voiceoverText di dalam ctaVariants", () => {
    const partial =
      '{"scenes":[{"order":5,"role":"cta","voiceoverText":"Cek di bawah ya","ctaVariants":{"tiktok":{"voiceoverText":"Klik keranjang kuning"}}}]}';
    expect(previewScenes(partial)).toEqual([{ role: "cta", text: "Cek di bawah ya", done: true }]);
  });
});
