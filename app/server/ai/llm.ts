// SATU-SATUNYA pintu ke LLM (agent.md §3). Provider: 9router (proxy OpenAI-compatible, /v1/chat/completions).
// Route tidak boleh memanggil SDK langsung. Dependensi Firestore & web search di-inject supaya bisa diuji tanpa jaringan.
import OpenAI from "openai";
import { z } from "zod";
import type { ApiRun } from "../../shared/schemas";
import { monthKeyJakarta } from "../../shared/duration";
import type { GateResult } from "../../shared/quality-gates";
import { estCostUsd } from "./pricing";
import { repairMessage } from "./prompts";

type Effort = "low" | "medium" | "high";
type StageName = ApiRun["stageName"];
type Content = string | OpenAI.Chat.ChatCompletionContentPart[];
type Msg = OpenAI.Chat.ChatCompletionMessageParam;
type Completion = OpenAI.Chat.ChatCompletion;

export type RunMeta = { ownerUid: string; entityType: string; entityId: string; stageName: StageName };
export type SearchResult = { title: string; url: string; content: string; publishedDate?: string };

export type LlmDeps = {
  /** Tulis 1 dokumen apiRuns (server menambah createdAt). Dipanggil untuk SETIAP panggilan, termasuk yang gagal. */
  logRun: (run: ApiRun) => Promise<void>;
  /** Lempar BudgetExceededError jika total estCostUsd bulan ini >= monthlyBudgetUsd. */
  assertWithinBudget: (ownerUid: string) => Promise<void>;
  /** Pencarian web untuk riset tren/produk. Tanpa ini, riset dilewati dan tren ditandai "tidak ada". */
  webSearch?: (query: string) => Promise<SearchResult[]>;
  /** Isi: new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey: process.env.LLM_API_KEY }). */
  client: OpenAI;
  /** Isi dari process.env.LLM_MODEL, mis. "cc/claude-sonnet-4-6" atau nama combo 9router. */
  model: string;
  /** Isi `process.env.LLM_SEND_EFFORT !== "off"`. Matikan jika provider menolak `reasoning_effort`. */
  sendEffort?: boolean;
};

export class RefusedError extends Error {}
export class BudgetExceededError extends Error {} // route memetakan ke HTTP 402
export class InvalidOutputError extends Error {}

/** Ambil objek JSON dari jawaban model (toleran terhadap ```json fence dan teks pembuka). */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Tidak ada objek JSON di jawaban model.");
  return JSON.parse(unfenced.slice(start, end + 1));
}

/**
 * Rakit ChatCompletion dari stream secara manual. Helper `.stream()` SDK menolak chunk tanpa `delta.role`
 * ("missing role for choice 0"), dan 9router tidak selalu mengirim role.
 */
export async function collectStream(
  stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
  fallbackModel: string,
  onText: (delta: string) => void,
): Promise<Completion> {
  let content = "";
  let refusal: string | null = null;
  let finish: OpenAI.Chat.ChatCompletion.Choice["finish_reason"] = "stop";
  let usage: OpenAI.CompletionUsage | undefined;
  let modelName = "";
  let id = "";
  for await (const chunk of stream) {
    id ||= chunk.id ?? "";
    modelName ||= chunk.model ?? "";
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta?.content;
    if (delta) {
      content += delta;
      onText(delta);
    }
    if (choice.delta?.refusal) refusal = (refusal ?? "") + choice.delta.refusal;
    if (choice.finish_reason) finish = choice.finish_reason;
  }
  return {
    id,
    object: "chat.completion",
    created: 0,
    model: modelName || fallbackModel,
    choices: [{ index: 0, finish_reason: finish, logprobs: null, message: { role: "assistant", content, refusal } }],
    usage,
  };
}

const jsonInstruction = (schema: z.ZodType) =>
  `<response_format>\nBalas HANYA dengan satu objek JSON valid (tanpa markdown, tanpa teks lain) yang sesuai JSON Schema ini:\n${JSON.stringify(
    z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
  )}\n</response_format>`;

export function createLlm(deps: LlmDeps) {
  const { client, model } = deps;

  async function log(
    meta: RunMeta,
    effort: Effort,
    started: number,
    status: ApiRun["status"],
    extra: { res?: Completion; escalatedFrom?: string; gate?: GateResult; errorMessage?: string; webSearchCount?: number },
  ) {
    const u = extra.res?.usage;
    const cached = u?.prompt_tokens_details?.cached_tokens ?? 0;
    const counts = {
      inputTokens: Math.max(0, (u?.prompt_tokens ?? 0) - cached),
      outputTokens: u?.completion_tokens ?? 0,
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
      webSearchCount: extra.webSearchCount ?? 0,
    };
    await deps.logRun({
      ...meta,
      ...counts,
      modelName: extra.res?.model || model, // model yang benar-benar menjawab (9router bisa fallback ke model lain)
      effort,
      escalatedFrom: extra.escalatedFrom,
      qualityGate: extra.gate,
      estCostUsd: estCostUsd(counts),
      latencyMs: Date.now() - started,
      status,
      errorMessage: extra.errorMessage?.slice(0, 500),
      monthKey: monthKeyJakarta(),
    });
  }

  /** Panggil API; jika SDK melempar error, tetap tulis apiRuns status failed lalu lempar ulang. */
  async function call(meta: RunMeta, effort: Effort, started: number, fn: () => Promise<Completion>): Promise<Completion> {
    try {
      return await fn();
    } catch (err) {
      await log(meta, effort, started, "failed", { errorMessage: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  const params = (messages: Msg[], effort: Effort, maxTokens: number, modelOverride?: string) => ({
    model: modelOverride ?? model,
    messages,
    max_tokens: maxTokens,
    ...(deps.sendEffort !== false ? { reasoning_effort: effort } : {}),
  });

  const textOf = (res: Completion) => res.choices[0]?.message.content ?? "";
  const refused = (res: Completion) =>
    Boolean(res.choices[0]?.message.refusal) || res.choices[0]?.finish_reason === "content_filter";

  function validate<S extends z.ZodType>(schema: S, text: string): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
    let json: unknown;
    try {
      json = extractJson(text);
    } catch (err) {
      return { ok: false, error: `Output bukan JSON lengkap (${err instanceof Error ? err.message : String(err)}).` };
    }
    const parsed = schema.safeParse(json);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: parsed.error.message };
  }

  /**
   * Satu tahap terstruktur: effort low -> quality gate -> eskalasi maks 1x ke medium (agent.md §3.4).
   * JSON gagal validasi Zod -> maks 1 repair. `content(issues)` dipanggil ulang saat eskalasi.
   * Jika `onText` diisi, panggilan pertama di-stream (script_draft) untuk ditampilkan di UI.
   */
  async function generate<S extends z.ZodType>(opts: {
    meta: RunMeta;
    systemPrompt: string;
    content: (issues?: string[]) => Content;
    schema: S;
    gate?: (data: z.infer<S>) => GateResult;
    effort?: Effort; // default "low"; "high" hanya dari tombol manual owner
    maxTokens?: number;
    onText?: (delta: string) => void;
    /** Model/combo lain untuk panggilan ini, mis. LLM_VISION_MODEL saat content berisi foto. */
    model?: string;
  }): Promise<{ data: z.infer<S>; gate?: GateResult; escalated: boolean }> {
    const system = `${opts.systemPrompt}\n\n${jsonInstruction(opts.schema)}`;
    const attempt = async (effort: Effort, issues?: string[], escalatedFrom?: string) => {
      await deps.assertWithinBudget(opts.meta.ownerUid);
      const started = Date.now();
      const messages: Msg[] = [
        { role: "system", content: system },
        { role: "user", content: opts.content(issues) },
      ];
      const p = params(messages, effort, opts.maxTokens ?? 16000, opts.model);
      let res = await call(opts.meta, effort, started, async () => {
        if (!opts.onText || issues) return client.chat.completions.create(p);
        return collectStream(
          await client.chat.completions.create({ ...p, stream: true, stream_options: { include_usage: true } }),
          model,
          opts.onText,
        );
      });
      if (refused(res)) {
        await log(opts.meta, effort, started, "refused", { res, escalatedFrom });
        throw new RefusedError(res.choices[0]?.message.refusal ?? "Permintaan ditolak model.");
      }
      let status: ApiRun["status"] = "success";
      let v = validate(opts.schema, textOf(res));
      if (!v.ok) {
        // log panggilan pertama dulu (token sudah terpakai), lalu 1x repair
        await log(opts.meta, effort, started, "failed", { res, escalatedFrom, errorMessage: v.error });
        const repairStarted = Date.now();
        const repairMsgs: Msg[] = [
          ...messages,
          { role: "assistant", content: textOf(res) },
          { role: "user", content: repairMessage(v.error) },
        ];
        res = await call(opts.meta, effort, repairStarted, () => client.chat.completions.create(params(repairMsgs, effort, opts.maxTokens ?? 16000, opts.model)));
        v = validate(opts.schema, textOf(res));
        if (!v.ok) {
          await log(opts.meta, effort, repairStarted, "failed", { res, escalatedFrom, errorMessage: v.error });
          throw new InvalidOutputError(v.error);
        }
        status = "repaired";
      }
      const gate = opts.gate?.(v.data);
      await log(opts.meta, effort, started, status, { res, escalatedFrom, gate });
      return { data: v.data, gate };
    };

    const effort = opts.effort ?? "low";
    const first = await attempt(effort);
    if (!first.gate || first.gate.passed || effort !== "low") return { ...first, escalated: false };
    const second = await attempt("medium", first.gate.reasons, "low");
    // Jangan loop: ambil hasil dengan masalah paling sedikit, temuan sisa tampil di Audit.
    const best = (second.gate?.reasons.length ?? 0) <= first.gate.reasons.length ? second : first;
    return { ...best, escalated: true };
  }

  /**
   * Riset web (trend_pulse / product_research tahap a): server mencari lewat deps.webSearch,
   * lalu LLM merangkum HANYA dari hasil pencarian itu, dengan URL sumber. Hasilnya diekstrak lewat generate().
   */
  async function research(opts: {
    meta: RunMeta;
    systemPrompt: string;
    prompt: string;
    queries: string[];
    maxSearches?: number;
    effort?: Effort;
  }): Promise<{ text: string; sources: { url: string; title: string }[] }> {
    if (!deps.webSearch) return { text: "", sources: [] };
    const effort = opts.effort ?? "low";
    await deps.assertWithinBudget(opts.meta.ownerUid);
    const queries = opts.queries.slice(0, opts.maxSearches ?? 3);
    const found = new Map<string, SearchResult>();
    for (const q of queries) for (const r of await deps.webSearch(q)) if (!found.has(r.url)) found.set(r.url, r);
    if (found.size === 0) return { text: "", sources: [] };

    const results = [...found.values()]
      .map((r, i) => `[s${i + 1}] ${r.title}\nURL: ${r.url}${r.publishedDate ? `\nTanggal: ${r.publishedDate}` : ""}\n${r.content.slice(0, 1500)}`)
      .join("\n\n");
    const started = Date.now();
    const res = await call(opts.meta, effort, started, () =>
      client.chat.completions.create(
        params(
          [
            { role: "system", content: opts.systemPrompt },
            {
              role: "user",
              content: `<search_results>\n${results.replace(/</g, "‹")}\n</search_results>\n\nGunakan HANYA hasil pencarian di atas; tulis URL sumber persis untuk setiap temuan.\n\n${opts.prompt}`,
            },
          ],
          effort,
          8000,
        ),
      ),
    );
    if (refused(res)) {
      await log(opts.meta, effort, started, "refused", { res, webSearchCount: queries.length });
      throw new RefusedError("Riset ditolak model.");
    }
    await log(opts.meta, effort, started, "success", { res, webSearchCount: queries.length });
    const text = textOf(res).trim();
    const cited = [...found.values()].filter((r) => text.includes(r.url));
    return { text, sources: cited.map((r) => ({ url: r.url, title: r.title })) };
  }

  return { generate, research, model };
}

export type Llm = ReturnType<typeof createLlm>;
