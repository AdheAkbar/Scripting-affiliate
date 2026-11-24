import { countWords, estimateSeconds } from "./duration";
import type { AnglesOut, HooksOut, ScriptDraftOut } from "./schemas/ai-outputs";

// Quality gate deterministik (agent.md §3.4): tanpa panggilan AI. Hasil -> apiRuns.qualityGate,
// dan `reasons` dikirim sebagai <previous_attempt_issues> saat eskalasi ke effort medium.
export type GateResult = { passed: boolean; reasons: string[] };

const result = (reasons: string[]): GateResult => ({ passed: reasons.length === 0, reasons });

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Frasa terlarang yang muncul di teks (case-insensitive, abaikan tanda baca, utuh per kata). */
export function findBannedPhrases(text: string, bannedPhrases: string[]): string[] {
  const hay = ` ${normalize(text)} `;
  return bannedPhrases.filter((p) => {
    const needle = normalize(p);
    return needle !== "" && hay.includes(` ${needle} `);
  });
}

export function gateAngles(
  out: AnglesOut,
  ctx: { faceMode: "face" | "faceless" | "mixed"; trendItemIds: string[] },
): GateResult {
  const reasons: string[] = [];
  const { angles } = out;
  if (angles.length < 3 || angles.length > 5) reasons.push(`Jumlah angle ${angles.length}, harus 3–5.`);
  if (angles.length > 1 && new Set(angles.map((a) => a.sellingStyle)).size === 1) {
    reasons.push("Semua angle memakai gaya jual yang sama; variasikan.");
  }
  if (ctx.faceMode === "mixed" && !angles.some((a) => !a.productionNeeds.showsFace)) {
    reasons.push("Mode campur: minimal 1 angle harus bisa direkam faceless (showsFace=false).");
  }
  if (ctx.faceMode === "faceless" && angles.some((a) => a.productionNeeds.showsFace)) {
    reasons.push("Brand faceless: tidak boleh ada angle yang menampilkan wajah.");
  }
  const known = new Set(ctx.trendItemIds);
  const unknownRefs = angles.flatMap((a) => a.trendItemRefs).filter((r) => !known.has(r));
  if (unknownRefs.length) reasons.push(`trendItemRefs tidak dikenal: ${[...new Set(unknownRefs)].join(", ")}.`);
  return result(reasons);
}

export function gateHooks(out: HooksOut, ctx: { bannedPhrases: string[] }): GateResult {
  const reasons: string[] = [];
  const { hooks } = out;
  if (hooks.length < 5) reasons.push(`Jumlah hook ${hooks.length}, minimal 5.`);
  const types = new Set(hooks.map((h) => h.psychologyType)).size;
  if (types < 3) reasons.push(`Hanya ${types} tipe psikologi hook; minimal 3 tipe berbeda.`);
  hooks.forEach((h, i) => {
    if (countWords(h.verbalHook) > 12) reasons.push(`Hook #${i + 1}: ucapan > 12 kata.`);
    if (countWords(h.textOnScreen) > 6) reasons.push(`Hook #${i + 1}: teks layar > 6 kata.`);
    const banned = findBannedPhrases(`${h.verbalHook} ${h.textOnScreen}`, ctx.bannedPhrases);
    if (banned.length) reasons.push(`Hook #${i + 1}: frasa terlarang "${banned.join('", "')}".`);
  });
  return result(reasons);
}

export function gateScript(
  draft: ScriptDraftOut,
  ctx: {
    targetDurationSec: { min: number; max: number };
    wpm: number;
    platformTargets: string[];
    factIds: string[];
    bannedPhrases: string[];
  },
): GateResult {
  const reasons: string[] = [];
  const { scenes } = draft;
  // Durasi dihitung dari kata VO (bukan dari durationSec karangan model). CTA dihitung pakai varian terpanjang.
  const sceneSec = scenes.map((s) => {
    const ctaTexts = Object.values(s.ctaVariants ?? {}).map((v) => v?.voiceoverText ?? "");
    const longest = [s.voiceoverText, ...ctaTexts].reduce((a, b) => (countWords(b) > countWords(a) ? b : a));
    return estimateSeconds(longest, ctx.wpm);
  });
  const total = sceneSec.reduce((a, b) => a + b, 0);
  const lo = ctx.targetDurationSec.min * 0.85;
  const hi = ctx.targetDurationSec.max * 1.15;
  if (total < lo || total > hi) {
    reasons.push(
      `Durasi VO ${total.toFixed(1)} dtk di luar target ${ctx.targetDurationSec.min}–${ctx.targetDurationSec.max} dtk (±15%).`,
    );
  }
  if (scenes[0]?.role !== "hook") reasons.push("Adegan pertama harus hook.");
  if ((sceneSec[0] ?? 0) > 3.5) reasons.push(`Hook ${sceneSec[0]} dtk; maksimal 3,5 dtk.`);

  const facts = new Set(ctx.factIds);
  scenes.forEach((s) => {
    if ((s.role === "proof" || s.role === "demo") && s.factIds.length === 0) {
      reasons.push(`Adegan ${s.order} (${s.role}) tidak menautkan factIds.`);
    }
    const bad = s.factIds.filter((id) => !facts.has(id));
    if (bad.length) reasons.push(`Adegan ${s.order}: factIds tidak ada di brief (${bad.join(", ")}).`);
    if (s.role === "cta") {
      for (const p of ctx.platformTargets) {
        if (!s.ctaVariants?.[p as keyof typeof s.ctaVariants]) reasons.push(`Adegan CTA tanpa varian ${p}.`);
      }
    }
  });
  if (!scenes.some((s) => s.role === "cta")) reasons.push("Tidak ada adegan CTA.");

  const allText = scenes
    .flatMap((s) => [s.voiceoverText, s.onScreenText ?? "", ...Object.values(s.ctaVariants ?? {}).map((v) => v?.voiceoverText ?? "")])
    .concat(Object.values(draft.postingPacks).flatMap((p) => [p.caption, p.pinnedComment]))
    .join(" \n ");
  const banned = findBannedPhrases(allText, ctx.bannedPhrases);
  if (banned.length) reasons.push(`Frasa terlarang muncul: "${banned.join('", "')}".`);

  if (draft.postingPacks.tiktok.caption.length > 150) reasons.push("Caption TikTok > 150 karakter.");
  return result(reasons);
}

/** Total detik VO (dipakai server untuk Script.totalEstSec). */
export function scriptSeconds(draft: Pick<ScriptDraftOut, "scenes">, wpm: number): number {
  return Math.round(draft.scenes.reduce((sum, s) => sum + estimateSeconds(s.voiceoverText, wpm), 0) * 10) / 10;
}
