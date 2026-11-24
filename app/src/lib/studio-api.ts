import type {
  AngleHooksOut,
  BrandInput,
  DurationPreset,
  HookOption,
  ProductInput,
  ResearchOut,
  ScriptOutV1,
  TrendIdeasOut,
} from "../../shared/schemas";
import { ApiError } from "./api";
import { auth } from "./firebase";

export type Angle = AngleHooksOut["angles"][number];
export type ProductSnap = { name: string; category: ResearchOut["category"]; url?: string; priceIdr?: number; notes?: string };
export type BriefSnap = Pick<ResearchOut, "painPoints" | "buyingTriggers" | "objections" | "verifiedFacts" | "forbiddenClaims">;
export type ScriptResult = {
  draft: ScriptOutV1;
  gate: { passed: boolean; reasons: string[] };
  totalEstSec: number;
  targetDurationSec: { min: number; max: number };
};

async function token(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Sesi habis. Masuk ulang dengan Google.");
  return user.getIdToken();
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok) throw new ApiError(res.status, data.code ?? "REQUEST_FAILED", data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const studioApi = {
  status: async () => {
    const res = await fetch("/api/studio/status", { headers: { Authorization: `Bearer ${await token()}` } });
    return (await res.json()) as { llm: boolean; webSearch: boolean; model: string | null };
  },

  research: (brand: BrandInput, product: ProductInput, signal?: AbortSignal) =>
    post<{ research: ResearchOut; pageRead: boolean; searched: number }>("/api/studio/research", { brand, product }, signal),

  hooks: (body: { brand: BrandInput; product: ProductSnap; brief: BriefSnap; winning: string[] }, signal?: AbortSignal) =>
    post<{ angles: Angle[] }>("/api/studio/hooks", body, signal),

  trends: (brand: BrandInput, category: string) => post<TrendIdeasOut>("/api/studio/trends", { brand, category }),

  /** Stream naskah. onDelta menerima potongan teks JSON mentah; resolve dengan hasil akhir. */
  async script(
    body: {
      brand: BrandInput;
      product: ProductSnap;
      brief: BriefSnap;
      winning: string[];
      angle: Omit<Angle, "hooks">;
      hook: HookOption;
      duration: DurationPreset;
      platforms: string[];
    },
    handlers: { onDelta: (text: string) => void; onStatus?: (msg: string) => void },
    signal?: AbortSignal,
  ): Promise<ScriptResult> {
    const res = await fetch("/api/studio/script", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      throw new ApiError(res.status, data.code ?? "REQUEST_FAILED", data.error ?? `HTTP ${res.status}`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let cut: number;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const event = block.match(/^event: (.+)$/m)?.[1];
        const raw = block.match(/^data: (.+)$/m)?.[1];
        if (!event || !raw) continue;
        const data = JSON.parse(raw);
        if (event === "delta") handlers.onDelta(data.text);
        else if (event === "status") handlers.onStatus?.(data.message);
        else if (event === "error") throw new ApiError(502, "LLM_ERROR", data.error);
        else if (event === "done") return data as ScriptResult;
      }
    }
    throw new ApiError(502, "STREAM_CLOSED", "Koneksi terputus sebelum naskah selesai. Coba lagi.");
  },
};
