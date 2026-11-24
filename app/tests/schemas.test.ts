import { describe, expect, it } from "vitest";
import { Brand, Hook, Product, RemotionExport, Script, toRemotionExport } from "../shared/schemas";
import { estimateSeconds, monthKeyJakarta } from "../shared/duration";
import { extractSharedUrl } from "../shared/share-target";

const fact = { id: "f1", text: "Lampu klip monitor dengan dial nirkabel", source: "user" as const };

const validScript = {
  ownerUid: "u1",
  productId: "p1",
  angleId: "a1",
  rootScriptId: "s1",
  versionNo: 1,
  videoFormat: "faceless_vo",
  targetDurationSec: { min: 25, max: 40 },
  totalEstSec: 12,
  scenes: [
    {
      order: 1, role: "hook", durationSec: 3.5, voiceoverText: "Mata perih kerja malam?",
      shot: { cameraAngle: "close-up" }, brollCue: "dark desk glare", factIds: [],
    },
    {
      order: 2, role: "proof", durationSec: 5, voiceoverText: "Dial nirkabelnya bikin cahaya pas.",
      shot: { cameraAngle: "overhead" }, brollCue: "dial turning", factIds: ["f1"],
    },
    {
      order: 3, role: "cta", durationSec: 3.5, voiceoverText: "Cek keranjang kuning.",
      shot: { cameraAngle: "eye-level" }, brollCue: "product hero",
      ctaVariants: {
        tiktok: { voiceoverText: "Cek keranjang kuning." },
        shopee: { voiceoverText: "Klik produk di bawah video." },
      },
    },
  ],
  postingPacks: {
    tiktok: { caption: "Kerja malam aman", hashtags: ["#a", "#b", "#c"], pinnedComment: "Link di keranjang" },
    shopee: { caption: "Kerja malam aman, cek voucher", hashtags: ["#a", "#b", "#c"], pinnedComment: "Klik produk" },
  },
  strategicBreakdown: { hookPsychology: "x", emotionLogicTrigger: "x", objectionHandling: "x", ctaReasoning: "x" },
  factsSnapshot: [fact],
};

describe("Script schema", () => {
  it("menerima script valid dengan default 2 platform", () => {
    const r = Script.safeParse(validScript);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.platformTargets).toEqual(["tiktok", "shopee"]);
  });

  it("menolak CTA tanpa varian Shopee", () => {
    const s = structuredClone(validScript);
    delete (s.scenes[2] as { ctaVariants?: Record<string, unknown> }).ctaVariants!.shopee;
    const r = Script.safeParse(s);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("CTA untuk shopee");
  });

  it("menolak factId yang tidak ada di factsSnapshot (fidelity)", () => {
    const s = structuredClone(validScript);
    s.scenes[1]!.factIds = ["fitur-karangan"];
    expect(Script.safeParse(s).success).toBe(false);
  });

  it("menolak adegan pertama yang bukan hook", () => {
    const s = structuredClone(validScript);
    s.scenes[0]!.role = "proof";
    expect(Script.safeParse(s).success).toBe(false);
  });

  it("menolak status ready tanpa audit lolos", () => {
    expect(Script.safeParse({ ...validScript, status: "ready" }).success).toBe(false);
  });

  it("menolak voiceover kosong", () => {
    const s = structuredClone(validScript);
    s.scenes[0]!.voiceoverText = "   ";
    expect(Script.safeParse(s).success).toBe(false);
  });
});

describe("Hook schema", () => {
  const base = { ownerUid: "u", angleId: "a", productId: "p", psychologyType: "pov", visualHook: "v" };
  it("menolak hook ucapan > 12 kata dan teks layar > 6 kata", () => {
    expect(Hook.safeParse({ ...base, verbalHook: "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas tiga belas", textOnScreen: "ok" }).success).toBe(false);
    expect(Hook.safeParse({ ...base, verbalHook: "pendek saja", textOnScreen: "satu dua tiga empat lima enam tujuh" }).success).toBe(false);
    expect(Hook.safeParse({ ...base, verbalHook: "pendek saja", textOnScreen: "bukan salah monitornya" }).success).toBe(true);
  });
});

describe("Brand & Product", () => {
  it("brand memakai default keputusan owner", () => {
    const b = Brand.parse({ ownerUid: "u", accountName: "a", personaTone: "t", visualAesthetic: "v", targetAudience: "x" });
    expect(b.primaryPlatforms).toEqual(["tiktok", "shopee"]);
    expect(b.faceMode).toBe("mixed");
    expect(b.defaultFormat).toBe("auto");
    expect(b.voiceoverWpm).toBe(140);
  });

  it("menolak WPM di luar 110–180", () => {
    expect(Brand.safeParse({ ownerUid: "u", accountName: "a", personaTone: "t", visualAesthetic: "v", targetAudience: "x", voiceoverWpm: 200 }).success).toBe(false);
  });

  it("produk link diblokir tanpa deskripsi & foto ditolak; dengan foto diterima", () => {
    const base = { ownerUid: "u", brandId: "b", name: "Serum", category: "skincare_beauty", scrapeStatus: "blocked", creatorNotes: "Teksturnya ringan" };
    expect(Product.safeParse(base).success).toBe(false);
    expect(Product.safeParse({ ...base, photoPaths: ["products/p/photos/1.jpg"] }).success).toBe(true);
  });

  it("produk wajib punya catatan pemakaian pribadi", () => {
    expect(Product.safeParse({ ownerUid: "u", brandId: "b", name: "x", category: "fashion", manualDescription: "kaos", creatorNotes: "" }).success).toBe(false);
  });
});

describe("Remotion export", () => {
  it("dibuat per platform dengan CTA yang sesuai & start_sec berurutan", () => {
    const script = { ...Script.parse(validScript), id: "s1" };
    const shopee = toRemotionExport(script, { platform: "shopee", productName: "Lampu", sellingStyle: "soft_sell_cinematic", brandAesthetic: "x" });
    expect(shopee.scenes[2]!.voiceover_text).toBe("Klik produk di bawah video.");
    expect(shopee.scenes.map((s) => s.start_sec)).toEqual([0, 3.5, 8.5]);
    expect(shopee.meta.total_duration_sec).toBe(12);
  });

  it("menolak payload tanpa broll_prompt_cue atau voiceover_text", () => {
    const ok = {
      schema_version: "1.0",
      meta: { script_id: "s", version_no: 1, platform: "tiktok", aspect_ratio: "9:16", fps: 30, total_duration_sec: 3, brand_aesthetic: "" },
      product: { name: "x", selling_style: "educational", strict_fidelity_notes: [] },
      scenes: [{ scene_order: 1, scene_role: "hook", start_sec: 0, duration_sec: 3, voiceover_text: "halo", broll_prompt_cue: "cue" }],
    };
    expect(RemotionExport.safeParse(ok).success).toBe(true);
    const noBroll = structuredClone(ok); noBroll.scenes[0]!.broll_prompt_cue = "";
    const noVo = structuredClone(ok); noVo.scenes[0]!.voiceover_text = "";
    expect(RemotionExport.safeParse(noBroll).success).toBe(false);
    expect(RemotionExport.safeParse(noVo).success).toBe(false);
  });
});

describe("Utilitas", () => {
  it("durasi = kata ÷ WPM", () => {
    expect(estimateSeconds("satu dua tiga empat lima enam tujuh", 140)).toBe(3);
    expect(() => estimateSeconds("x", 0)).toThrow();
  });

  it("monthKey memakai WIB: 31 Des 20:00 UTC = Januari di Jakarta", () => {
    expect(monthKeyJakarta(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01");
    expect(monthKeyJakarta(new Date("2026-11-22T10:00:00Z"))).toBe("2026-11");
  });

  it("ambil link dari text share marketplace", () => {
    expect(extractSharedUrl({ text: "Cek produk ini! https://vt.tokopedia.com/abc123 murah" })).toBe("https://vt.tokopedia.com/abc123");
    expect(extractSharedUrl({ url: "https://shopee.co.id/item-i.1.2", text: "x" })).toBe("https://shopee.co.id/item-i.1.2");
    expect(extractSharedUrl({ text: "tanpa link" })).toBeNull();
    expect(extractSharedUrl({ text: "lihat (https://s.shopee.co.id/xyz)." })).toBe("https://s.shopee.co.id/xyz");
  });
});
