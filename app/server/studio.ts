// Route AI alur Studio V1. Semua panggilan LLM lewat createLlm() (9router); log ke apiRuns memakai ID token owner.
import express, { type Request, type Response, type Router } from "express";
import OpenAI from "openai";
import type { z } from "zod";
import { CATEGORY_LABEL } from "../shared/labels";
import { gateAngleHooks, gateScript, gateStory, scriptSeconds } from "../shared/quality-gates";
import {
  AngleHooksOut,
  DURATION_PRESETS,
  HooksRequest,
  ResearchOut,
  ResearchRequest,
  ScriptOutV1,
  ScriptRequest,
  TrendIdeasOut,
  TrendsRequest,
  type BrandInput,
} from "../shared/schemas";
import { createLlm, InvalidOutputError, RefusedError, type SearchResult } from "./ai/llm";
import { buildSystemPrompt } from "./ai/prompts";
import {
  angleHooksTask,
  briefBlockV1,
  productBlockV1,
  productQueriesV1,
  researchTask,
  scriptTaskV1,
  selectedBlock,
  trendIdeasTask,
  trendQueriesV1,
  winningBlockV1,
} from "./ai/studio-prompts";
import { firestoreRestCreate } from "./firestore-rest";
import { extractProductPage } from "./research/link-extractor";
import { createTavilySearch } from "./research/web-search";

class ConfigError extends Error {}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  const baseURL = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!baseURL || !apiKey || !process.env.LLM_MODEL?.trim()) {
    throw new ConfigError("LLM belum dikonfigurasi. Isi LLM_BASE_URL, LLM_API_KEY, dan LLM_MODEL di file .env.");
  }
  client ??= new OpenAI({ baseURL, apiKey, timeout: 120_000, maxRetries: 1 });
  return client;
}

const tavilyKey = () => process.env.TAVILY_API_KEY?.trim();
/** Model untuk tahap kreatif (hook & naskah). Kosong = LLM_MODEL. Riset tetap pakai LLM_MODEL (cepat). */
const writerModel = () => process.env.LLM_SCRIPT_MODEL?.trim() || undefined;

function llmFor(req: Request) {
  const key = tavilyKey();
  return createLlm({
    client: getClient(),
    model: process.env.LLM_MODEL!.trim(),
    sendEffort: process.env.LLM_SEND_EFFORT !== "off",
    webSearch: key ? createTavilySearch(key) : undefined,
    assertWithinBudget: async () => {}, // 9router gratis: tanpa batas anggaran
    logRun: async (run) => {
      // Log tidak boleh menggagalkan generate.
      await firestoreRestCreate("apiRuns", { ...run, createdAt: new Date() }, req.idToken!).catch((err) =>
        console.warn("apiRuns gagal ditulis:", err instanceof Error ? err.message : err),
      );
    },
  });
}

async function search(queries: string[]): Promise<SearchResult[]> {
  const key = tavilyKey();
  if (!key) return [];
  const run = createTavilySearch(key);
  const found = new Map<string, SearchResult>();
  const batches = await Promise.allSettled(queries.map((q) => run(q)));
  for (const b of batches) if (b.status === "fulfilled") for (const r of b.value) if (!found.has(r.url)) found.set(r.url, r);
  return [...found.values()].slice(0, 10);
}

function parse<S extends z.ZodType>(schema: S, req: Request, res: Response): z.infer<S> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", error: parsed.error.issues[0]?.message ?? "Input tidak valid." });
    return null;
  }
  return parsed.data;
}

function fail(res: Response, err: unknown) {
  if (err instanceof ConfigError) return res.status(503).json({ code: "NOT_CONFIGURED", error: err.message });
  if (err instanceof RefusedError) return res.status(422).json({ code: "REFUSED", error: "Model menolak permintaan ini. Ubah input lalu coba lagi." });
  if (err instanceof InvalidOutputError) return res.status(502).json({ code: "BAD_OUTPUT", error: "Jawaban AI tidak lengkap. Coba lagi." });
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(502).json({ code: "LLM_ERROR", error: `Gagal menghubungi 9router: ${msg.slice(0, 200)}` });
}

const system = (brand: BrandInput) => buildSystemPrompt(brand);
const meta = (req: Request, stageName: Parameters<ReturnType<typeof createLlm>["generate"]>[0]["meta"]["stageName"], entityId: string) => ({
  ownerUid: req.owner!.uid,
  entityType: "studio",
  entityId,
  stageName,
});

export function createStudioRouter(): Router {
  const router = express.Router();

  router.get("/status", (_req, res) => {
    res.json({
      llm: Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL),
      webSearch: Boolean(tavilyKey()),
      model: process.env.LLM_MODEL ?? null,
      writerModel: writerModel() ?? process.env.LLM_MODEL ?? null,
    });
  });

  router.post("/research", async (req, res) => {
    const body = parse(ResearchRequest, req, res);
    if (!body) return;
    try {
      const llm = llmFor(req);
      const page = body.product.url ? await extractProductPage(body.product.url) : undefined;
      const pageSpecs = page?.status === "success" ? page.specs : undefined;
      const name = body.product.name || pageSpecs?.name;
      const results = name ? await search(productQueriesV1(name.slice(0, 80))) : [];
      if (!name && !pageSpecs) {
        res.status(422).json({ code: "NEED_NAME", error: "Halaman produk tidak bisa dibaca. Ketik nama produknya." });
        return;
      }
      const out = await llm.generate({
        meta: meta(req, "brief_extract", "research"),
        systemPrompt: system(body.brand),
        content: () => researchTask({ input: body.product, page: pageSpecs, results }),
        schema: ResearchOut,
        maxTokens: 6000,
      });
      res.json({ research: out.data, pageRead: Boolean(pageSpecs), searched: results.length });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post("/hooks", async (req, res) => {
    const body = parse(HooksRequest, req, res);
    if (!body) return;
    try {
      const out = await llmFor(req).generate({
        meta: meta(req, "hooks", "hooks"),
        systemPrompt: system(body.brand),
        content: (issues) =>
          [productBlockV1(body.product), briefBlockV1(body.brief), winningBlockV1(body.winning), angleHooksTask(issues)].filter(Boolean).join("\n\n"),
        schema: AngleHooksOut,
        gate: (d) => gateAngleHooks(d, { faceMode: body.brand.faceMode, bannedPhrases: body.brand.bannedPhrases }),
        maxTokens: 6000,
        model: writerModel(),
      });
      res.json({ angles: out.data.angles });
    } catch (err) {
      fail(res, err);
    }
  });

  // Streaming naskah (Server-Sent Events lewat fetch): event delta -> done | error.
  router.post("/script", async (req, res) => {
    const body = parse(ScriptRequest, req, res);
    if (!body) return;
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const llm = llmFor(req);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const target = DURATION_PRESETS[body.duration];
      const ctx = {
        targetDurationSec: { min: target.min, max: target.max },
        wpm: body.brand.voiceoverWpm,
        platformTargets: body.platforms,
        factIds: body.brief.verifiedFacts.map((f) => f.id),
        bannedPhrases: body.brand.bannedPhrases,
      };
      let retrying = false;
      const out = await llm.generate({
        meta: meta(req, "script_draft", "script"),
        systemPrompt: system(body.brand),
        content: (issues) => {
          if (issues) {
            retrying = true;
            send("status", { message: "Merapikan naskah…" });
          }
          return [
            productBlockV1(body.product),
            briefBlockV1(body.brief),
            winningBlockV1(body.winning),
            selectedBlock(body.angle, body.hook),
            scriptTaskV1({ min: target.min, max: target.max, wpm: ctx.wpm, platforms: body.platforms, issues }),
          ]
            .filter(Boolean)
            .join("\n\n");
        },
        schema: ScriptOutV1,
        gate: (d) => {
          const a = gateScript(d, ctx);
          const b = gateStory(d, { platformTargets: body.platforms });
          const reasons = [...b.reasons, ...a.reasons];
          return { passed: reasons.length === 0, reasons };
        },
        onText: (delta) => !retrying && send("delta", { text: delta }),
        maxTokens: 10000,
        model: writerModel(),
      });
      send("done", {
        draft: out.data,
        gate: out.gate ?? { passed: true, reasons: [] },
        totalEstSec: scriptSeconds(out.data, ctx.wpm),
        targetDurationSec: ctx.targetDurationSec,
      });
      res.end();
    } catch (err) {
      console.error("script gagal:", err);
      if (!res.headersSent) return void fail(res, err);
      const msg =
        err instanceof ConfigError || err instanceof RefusedError
          ? err.message
          : err instanceof InvalidOutputError
            ? "Jawaban AI tidak lengkap. Coba lagi."
            : `Gagal membuat naskah: ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`;
      send("error", { error: msg });
      res.end();
    }
  });

  router.post("/trends", async (req, res) => {
    const body = parse(TrendsRequest, req, res);
    if (!body) return;
    if (!tavilyKey()) {
      res.status(503).json({ code: "NO_SEARCH", error: "Isi TAVILY_API_KEY di .env untuk riset tren." });
      return;
    }
    try {
      const label = CATEGORY_LABEL[body.category] ?? body.category;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      const results = await search(trendQueriesV1(label, today));
      if (results.length === 0) {
        res.json({ ideas: [] });
        return;
      }
      const out = await llmFor(req).generate({
        meta: meta(req, "trend_pulse", `trends-${body.category}`),
        systemPrompt: system(body.brand),
        content: () => trendIdeasTask(label, today, results),
        schema: TrendIdeasOut,
        maxTokens: 4000,
      });
      const urls = new Set(results.map((r) => r.url));
      res.json({ ideas: out.data.ideas.filter((i) => urls.has(i.sourceUrl)) });
    } catch (err) {
      fail(res, err);
    }
  });

  return router;
}
