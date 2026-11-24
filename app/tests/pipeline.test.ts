import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { z } from "zod";
import {
  AnglesOut, ApiRun, AuditOut, BriefOut, HooksOut, IdeasOut, ScriptDraftOut, TrendPulseOut, ViralPatternOut,
} from "../shared/schemas";
import { findBannedPhrases, gateAngles, gateHooks, gateScript, scriptSeconds } from "../shared/quality-gates";
import { markWinning, performanceScore, summarizeWinningPatterns } from "../shared/performance";
import { estCostUsd } from "../server/ai/pricing";
import { buildSystemPrompt, productQueries, trendBlock, trendQueries } from "../server/ai/prompts";
import { createLlm, extractJson, InvalidOutputError, RefusedError, type SearchResult } from "../server/ai/llm";
import { extractProductPage } from "../server/research/link-extractor";

// ---------- fixtures ----------
const words = (n: number) => Array.from({ length: n }, (_, i) => `kata${i}`).join(" ");
const pack = { caption: "Serum ini enak dipakai pagi", hashtags: ["#skincare", "#serum", "#review"], pinnedComment: "Kulitmu tipe apa?" };
const goodDraft = (): ScriptDraftOut => ({
  scenes: [
    { order: 1, role: "hook", durationSec: 3, voiceoverText: words(7), shot: { cameraAngle: "close-up" }, brollCue: "tekstur", factIds: [] },
    { order: 2, role: "proof", durationSec: 10, voiceoverText: words(30), shot: { cameraAngle: "medium" }, brollCue: "label", factIds: ["f1"] },
    { order: 3, role: "demo", durationSec: 10, voiceoverText: words(30), shot: { cameraAngle: "tangan" }, brollCue: "oles", factIds: ["f1"] },
    {
      order: 4, role: "cta", durationSec: 4, voiceoverText: words(10), shot: { cameraAngle: "medium" }, brollCue: "produk", factIds: [],
      ctaVariants: { tiktok: { voiceoverText: "Cek keranjang kuning ya" }, shopee: { voiceoverText: "Klik produk di bawah video" } },
    },
  ],
  postingPacks: { tiktok: pack, shopee: pack },
  strategicBreakdown: { hookPsychology: "a", emotionLogicTrigger: "b", objectionHandling: "c", ctaReasoning: "d" },
});
const scriptCtx = { targetDurationSec: { min: 25, max: 40 }, wpm: 140, platformTargets: ["tiktok", "shopee"], factIds: ["f1"], bannedPhrases: ["racun banget"] };

const angle = (style: string, showsFace: boolean) => ({
  angleTitle: "x", sellingStyle: style, videoFormat: "faceless_vo", targetAwareness: "problem_aware", whyItFits: "y",
  trendItemRefs: ["t1"], productionNeeds: { showsFace, needsPhysicalProduct: true },
}) as AnglesOut["angles"][number];
const hook = (type: string, verbal = "Kulit kusam tiap pagi?") => ({
  psychologyType: type, verbalHook: verbal, visualHook: "close-up", textOnScreen: "Kusam tiap pagi",
}) as HooksOut["hooks"][number];

// ---------- skema output AI bisa dikonversi ke JSON Schema untuk prompt ----------
describe("ai-outputs", () => {
  it.each([
    ["TrendPulseOut", TrendPulseOut], ["BriefOut", BriefOut], ["AnglesOut", AnglesOut], ["HooksOut", HooksOut],
    ["ScriptDraftOut", ScriptDraftOut], ["AuditOut", AuditOut], ["ViralPatternOut", ViralPatternOut], ["IdeasOut", IdeasOut],
  ])("%s -> z.toJSONSchema tanpa error", (_n, schema) => {
    expect(() => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })).not.toThrow();
  });
  it("ScriptDraftOut menerima draft valid", () => {
    expect(ScriptDraftOut.safeParse(goodDraft()).success).toBe(true);
  });
});

// ---------- quality gates ----------
describe("quality gates", () => {
  it("findBannedPhrases: abaikan kapital & tanda baca, utuh per kata", () => {
    expect(findBannedPhrases("Ini RACUN, banget!", ["racun banget"])).toEqual(["racun banget"]);
    expect(findBannedPhrases("racunbanget", ["racun banget"])).toEqual([]);
  });
  it("gateScript lolos untuk draft valid (~31 dtk)", () => {
    expect(scriptSeconds(goodDraft(), 140)).toBeGreaterThan(25);
    expect(gateScript(goodDraft(), scriptCtx)).toEqual({ passed: true, reasons: [] });
  });
  it("gateScript menangkap durasi, fakta, CTA, frasa terlarang", () => {
    const d = goodDraft();
    d.scenes[1]!.factIds = [];
    d.scenes[2]!.factIds = ["f9"];
    d.scenes[3]!.ctaVariants = { tiktok: { voiceoverText: "racun banget, cek keranjang" } };
    const r = gateScript(d, { ...scriptCtx, targetDurationSec: { min: 10, max: 12 } });
    expect(r.passed).toBe(false);
    expect(r.reasons.join("|")).toMatch(/Durasi/);
    expect(r.reasons.join("|")).toMatch(/tidak menautkan factIds/);
    expect(r.reasons.join("|")).toMatch(/f9/);
    expect(r.reasons.join("|")).toMatch(/tanpa varian shopee/);
    expect(r.reasons.join("|")).toMatch(/racun banget/);
  });
  it("gateAngles: variasi gaya, faceless untuk mode campur, ref tren dikenal", () => {
    const ok = { angles: [angle("educational", true), angle("storytelling", false), angle("hard_sell", true)] };
    expect(gateAngles(ok, { faceMode: "mixed", trendItemIds: ["t1"] }).passed).toBe(true);
    const bad = { angles: [angle("educational", true), angle("educational", true), angle("educational", true)] };
    expect(gateAngles(bad, { faceMode: "mixed", trendItemIds: [] }).reasons).toHaveLength(3);
  });
  it("gateHooks: jumlah, variasi tipe, panjang, frasa terlarang", () => {
    const ok = { hooks: ["pov", "contrarian", "proof_first", "pov", "relatable_pain"].map((t) => hook(t)) };
    expect(gateHooks(ok, { bannedPhrases: [] }).passed).toBe(true);
    const bad = { hooks: [hook("pov", `racun banget ${words(12)}`), hook("pov")] };
    const r = gateHooks(bad, { bannedPhrases: ["racun banget"] });
    expect(r.reasons.join("|")).toMatch(/minimal 5/);
    expect(r.reasons.join("|")).toMatch(/minimal 3 tipe/);
    expect(r.reasons.join("|")).toMatch(/> 12 kata/);
    expect(r.reasons.join("|")).toMatch(/frasa terlarang/);
  });
});

// ---------- performa, harga, prompt ----------
describe("performa & biaya", () => {
  it("skor = terjual per 1.000 views; proxy klik/10", () => {
    expect(performanceScore({ views: 10_000, unitsSold: 25 })).toBe(2.5);
    expect(performanceScore({ views: 1_000, productClicks: 30 })).toBe(3);
    expect(performanceScore({ unitsSold: 5 })).toBe(0);
  });
  it("winning = top 20%, minimal 5 log", () => {
    const logs = [5, 4, 3, 2, 1, 0.5].map((score, i) => ({ id: `l${i}`, score }));
    expect([...markWinning(logs)]).toEqual(["l0", "l1"]);
    expect(markWinning(logs.slice(0, 4)).size).toBe(0);
  });
  it("ringkasan winning pattern", () => {
    expect(summarizeWinningPatterns([])).toBe("");
    const s = summarizeWinningPatterns([{ hookType: "pov", videoFormat: "faceless_vo", sellingStyle: "honest_review", category: "fashion", totalEstSec: 30 }]);
    expect(s).toMatch(/pov \(1x\)/);
  });
  it("estCostUsd tarif setara default", () => {
    const c = estCostUsd({ inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, webSearchCount: 3 });
    expect(c).toBeCloseTo(2 + 1 + 0.1 + 0.024, 6);
  });
  it("kata kunci riset", () => {
    expect(trendQueries("fashion", "shopee", "2026-11-23")[0]).toMatch(/Shopee Video fashion .*November 2026/);
    expect(productQueries("Serum X", "skincare_beauty")[2]).toMatch(/BPOM/);
  });
  it("system prompt stabil (tanpa tanggal) & data user di-escape", () => {
    const brand = { accountName: "a<b>", personaTone: "santai", visualAesthetic: "terang", targetAudience: "18-45", faceMode: "mixed" as const, voiceoverWpm: 140, bannedPhrases: ["racun banget"], contentPillars: [], styleExamples: [] };
    const s1 = buildSystemPrompt(brand);
    expect(s1).toBe(buildSystemPrompt(brand));
    expect(s1).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(s1).toContain("racun banget");
    expect(s1).not.toContain("a<b>");
    expect(trendBlock([])).toMatch(/Jangan mengarang tren/);
  });
});

// ---------- link extractor (tanpa jaringan) ----------
const fakeFetch = (impl: () => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch;
describe("link-extractor", () => {
  it.each([403, 429])("HTTP %i -> blocked, tidak throw", async (code) => {
    const r = await extractProductPage("https://x.test/p", fakeFetch(async () => new Response("no", { status: code })));
    expect(r).toEqual({ status: "blocked", reason: `http_${code}` });
  });
  it("timeout -> blocked", async () => {
    const err = Object.assign(new Error("t"), { name: "TimeoutError" });
    const r = await extractProductPage("https://x.test/p", fakeFetch(async () => { throw err; }));
    expect(r).toEqual({ status: "blocked", reason: "timeout" });
  });
  it("halaman CAPTCHA -> blocked", async () => {
    const r = await extractProductPage("https://x.test/p", fakeFetch(async () => new Response("<html>Please verify you are human</html>")));
    expect(r).toEqual({ status: "blocked", reason: "captcha" });
  });
  it("JSON-LD + og meta -> success", async () => {
    const html = `<html><head><meta property="og:image" content="https://x.test/i.jpg">
      <script type="application/ld+json">{"@type":"Product","name":"Serum A &amp; B","brand":{"name":"Merk"},"offers":{"price":"99000","priceCurrency":"IDR"}}</script></head></html>`;
    const r = await extractProductPage("https://x.test/p", fakeFetch(async () => new Response(html)));
    expect(r).toEqual({ status: "success", specs: { name: "Serum A & B", brand: "Merk", price: "99000", priceCurrency: "IDR", image: "https://x.test/i.jpg" } });
  });
});

// ---------- wrapper LLM (9router, format OpenAI) dengan client palsu ----------
function fakeMessage(text: string, finish = "stop", refusal: string | null = null) {
  return {
    id: "c", object: "chat.completion", created: 0, model: "cc/claude-sonnet-4-6",
    choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content: text, refusal } }],
    usage: { prompt_tokens: 180, completion_tokens: 50, total_tokens: 230, prompt_tokens_details: { cached_tokens: 80 } },
  };
}
function setup(responses: ReturnType<typeof fakeMessage>[], webSearch?: (q: string) => Promise<SearchResult[]>) {
  const runs: ApiRun[] = [];
  const create = vi.fn(async () => responses.shift());
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  const llm = createLlm({ client, model: "combo-test", webSearch, logRun: async (r) => void runs.push(ApiRun.parse(r)), assertWithinBudget: async () => {} });
  const meta = { ownerUid: "u", entityType: "angle", entityId: "a1", stageName: "hooks" as const };
  return { claude: llm, runs, create, meta };
}
const hooksJson = (types: string[]) => JSON.stringify({ hooks: types.map((t) => hook(t)) });

describe("extractJson", () => {
  it("toleran terhadap fence markdown & teks pembuka", () => {
    expect(extractJson('Berikut:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("tidak ada json")).toThrow();
  });
});

describe("createLlm.generate", () => {
  it("lolos gate di effort low: 1 panggilan, reasoning_effort & JSON schema dikirim, log success", async () => {
    const { claude, runs, create, meta } = setup([fakeMessage("```json\n" + hooksJson(["pov", "contrarian", "proof_first", "pov", "pov"]) + "\n```")]);
    const r = await claude.generate({ meta, systemPrompt: "s", content: () => "t", schema: HooksOut, gate: (d) => gateHooks(d, { bannedPhrases: [] }) });
    expect(r.escalated).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    const params = (create.mock.calls[0] as unknown[])[0] as { model: string; reasoning_effort: string; messages: { role: string; content: string }[] };
    expect(params.model).toBe("combo-test");
    expect(params.reasoning_effort).toBe("low");
    expect(params.messages[0]!.content).toContain("psychologyType"); // JSON schema ikut di system
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "success", effort: "low", inputTokens: 100, cacheReadTokens: 80, modelName: "cc/claude-sonnet-4-6", qualityGate: { passed: true } });
  });
  it("model override (vision) dipakai di panggilan & repair", async () => {
    const { claude, create, meta } = setup([fakeMessage("{rusak"), fakeMessage(hooksJson(["pov", "contrarian", "proof_first", "pov", "pov"]))]);
    await claude.generate({ meta, systemPrompt: "s", content: () => "t", schema: HooksOut, model: "AdheVision" });
    expect(create.mock.calls.map((c) => ((c as unknown[])[0] as { model: string }).model)).toEqual(["AdheVision", "AdheVision"]);
  });
  it("gate gagal -> tepat 1 eskalasi medium dengan issues, tanpa loop", async () => {
    const bad = fakeMessage(hooksJson(["pov", "pov"]));
    const { claude, runs, create, meta } = setup([bad, fakeMessage(hooksJson(["pov", "pov"]))]);
    const seen: (string[] | undefined)[] = [];
    const r = await claude.generate({ meta, systemPrompt: "s", content: (i) => (seen.push(i), "t"), schema: HooksOut, gate: (d) => gateHooks(d, { bannedPhrases: [] }) });
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.escalated).toBe(true);
    expect(seen[1]?.join("|")).toMatch(/minimal 5/);
    expect(runs.map((x) => [x.effort, x.escalatedFrom])).toEqual([["low", undefined], ["medium", "low"]]);
  });
  it("JSON tidak valid -> 1x repair lalu status repaired", async () => {
    const { claude, runs, meta } = setup([fakeMessage("{rusak"), fakeMessage(hooksJson(["pov", "contrarian", "proof_first", "pov", "pov"]))]);
    await claude.generate({ meta, systemPrompt: "s", content: () => "t", schema: HooksOut });
    expect(runs.map((x) => x.status)).toEqual(["failed", "repaired"]);
  });
  it("repair juga gagal -> InvalidOutputError", async () => {
    const { claude, meta } = setup([fakeMessage("{rusak"), fakeMessage("{masih rusak")]);
    await expect(claude.generate({ meta, systemPrompt: "s", content: () => "t", schema: HooksOut })).rejects.toBeInstanceOf(InvalidOutputError);
  });
  it("refusal -> RefusedError + log refused", async () => {
    const { claude, runs, meta } = setup([fakeMessage("", "stop", "Tidak bisa membantu")]);
    await expect(claude.generate({ meta, systemPrompt: "s", content: () => "t", schema: HooksOut })).rejects.toBeInstanceOf(RefusedError);
    expect(runs[0]?.status).toBe("refused");
  });
});

describe("createLlm.research", () => {
  const meta = { ownerUid: "u", entityType: "trend", entityId: "t", stageName: "trend_pulse" as const };
  it("tanpa webSearch -> dilewati, tanpa panggilan LLM", async () => {
    const { claude, create } = setup([]);
    expect(await claude.research({ meta, systemPrompt: "s", prompt: "p", queries: ["q"] })).toEqual({ text: "", sources: [] });
    expect(create).not.toHaveBeenCalled();
  });
  it("hasil search dirangkum; sources hanya URL yang dikutip; webSearchCount tercatat", async () => {
    const search = vi.fn(async (q: string) => [
      { title: `A ${q}`, url: "https://a.test/1", content: "isi a" },
      { title: "B", url: "https://b.test/2", content: "isi b" },
    ]);
    const { claude, runs } = setup([fakeMessage("Format POV naik (https://a.test/1)")], search);
    const r = await claude.research({ meta, systemPrompt: "s", prompt: "p", queries: ["q1", "q2", "q3", "q4"] });
    expect(search).toHaveBeenCalledTimes(3); // maxSearches default 3
    expect(r.sources).toEqual([{ url: "https://a.test/1", title: "A q1" }]);
    expect(runs[0]).toMatchObject({ status: "success", webSearchCount: 3 });
  });
});
