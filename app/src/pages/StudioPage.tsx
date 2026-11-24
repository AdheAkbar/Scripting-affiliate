import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Play, RefreshCw, X } from "lucide-react";
import { DURATION_PRESETS, type DurationPreset } from "../../shared/schemas";
import { CATEGORY_LABEL, FORMAT_LABEL, HOOK_TYPE_LABEL } from "../../shared/labels";
import { extractSharedUrl } from "../../shared/share-target";
import { useStudio } from "../contexts/StudioContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { PlatformSwitch, PostingPack, SceneList, roleColor, scriptAsText, useCopy, CopyButton, type Platform } from "../components/script/ScriptView";
import { ROLE_LABEL } from "../../shared/labels";
import { previewScenes } from "../lib/stream-preview";
import { saveScript, winningExamples } from "../lib/scripts-store";
import { studioApi, type Angle, type BriefSnap, type ProductSnap, type ScriptResult } from "../lib/studio-api";
import { useSessionState } from "../lib/use-session-state";
import { cn } from "../lib/utils";

type Busy = null | "research" | "hooks" | "script";
interface Session {
  input: { url: string; name: string; notes: string };
  product?: ProductSnap;
  brief?: BriefSnap;
  pageRead?: boolean;
  gaps?: string[];
  angles?: Angle[];
  duration: DurationPreset;
  picked?: { a: number; h: number };
  result?: ScriptResult;
  savedId?: string;
}
const EMPTY: Session = { input: { url: "", name: "", notes: "" }, duration: "medium" };

const BUSY_COPY: Record<Exclude<Busy, null>, string> = {
  research: "Membaca produk & mencari ulasan…",
  hooks: "Menyusun angle dan hook…",
  script: "Menulis naskah…",
};

function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.";
}

export function StudioPage() {
  const { brandInput, owner, scripts, refreshScripts } = useStudio();
  const [s, setS] = useSessionState<Session>("studio-session", EMPTY);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const abort = useRef<AbortController | null>(null);
  const copy = useCopy();

  const platforms = useMemo<Platform[]>(() => {
    const p = (brandInput?.primaryPlatforms ?? []).filter((x): x is Platform => x === "tiktok" || x === "shopee");
    return p.length ? p : ["tiktok", "shopee"];
  }, [brandInput]);
  const [platform, setPlatform] = useState<Platform>(platforms[0]!);
  const winning = useMemo(() => winningExamples(scripts), [scripts]);

  // Share dari TikTok/Shopee (?url/text/title) atau dari halaman Ide (?name/notes).
  useEffect(() => {
    const shared = extractSharedUrl({ url: params.get("url"), text: params.get("text"), title: params.get("title") });
    const name = params.get("name");
    if (!shared && !name) return;
    const input = { url: shared ?? "", name: name ?? "", notes: params.get("notes") ?? "" };
    setS({ ...EMPTY, input });
    setParams({}, { replace: true });
    if (shared) void start(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  async function run<T>(kind: Exclude<Busy, null>, fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      return await fn(ctrl.signal);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(errorText(err));
      return null;
    } finally {
      if (abort.current === ctrl) setBusy(null);
    }
  }

  async function start(input = s.input) {
    if (!brandInput) return;
    const url = input.url.trim();
    const product = { url: url || undefined, name: input.name.trim() || undefined, notes: input.notes.trim() || undefined };
    const out = await run("research", (signal) => studioApi.research(brandInput, product, signal));
    if (!out) return;
    const { productName, category, priceIdr, gaps, ...brief } = out.research;
    const snap: ProductSnap = { name: productName, category, priceIdr, url: product.url, notes: product.notes };
    setS((prev) => ({ ...prev, input, product: snap, brief, gaps, pageRead: out.pageRead, angles: undefined, picked: undefined, result: undefined, savedId: undefined }));
    await loadHooks(snap, brief);
  }

  /** Jawaban owner atas `gaps` jadi fakta baru (source user), lalu hook dibuat ulang dengan bahan yang lebih kuat. */
  async function addInfo(text: string) {
    if (!s.brief || !text.trim()) return;
    const facts = s.brief.verifiedFacts;
    const next = text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t, i) => ({ id: `f${facts.length + i + 1}`, text: t, source: "user" as const }));
    const brief = { ...s.brief, verifiedFacts: [...facts, ...next] };
    setS((prev) => ({ ...prev, brief, gaps: [] }));
    await loadHooks(s.product, brief);
  }

  async function loadHooks(product = s.product, brief = s.brief) {
    if (!brandInput || !product || !brief) return;
    const out = await run("hooks", (signal) => studioApi.hooks({ brand: brandInput, product, brief, winning }, signal));
    if (out) setS((prev) => ({ ...prev, angles: out.angles, picked: undefined, result: undefined, savedId: undefined }));
  }

  async function pickHook(a: number, h: number) {
    if (!brandInput || !s.product || !s.brief || !s.angles) return;
    const { hooks, ...angle } = s.angles[a]!;
    const hook = hooks[h]!;
    setS((prev) => ({ ...prev, picked: { a, h }, result: undefined, savedId: undefined }));
    setRaw("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const result = await run("script", (signal) =>
      studioApi.script(
        { brand: brandInput, product: s.product!, brief: s.brief!, winning, angle, hook, duration: s.duration, platforms },
        { onDelta: (t) => setRaw((r) => r + t), onStatus: setStatus },
        signal,
      ),
    );
    if (!result || !owner) return;
    setS((prev) => ({ ...prev, result }));
    try {
      const id = await saveScript({
        ownerUid: owner.uid,
        product: s.product,
        facts: s.brief.verifiedFacts,
        angleTitle: angle.angleTitle,
        hook,
        platforms,
        targetDurationSec: result.targetDurationSec,
        totalEstSec: result.totalEstSec,
        throughline: result.draft.throughline,
        scenes: result.draft.scenes,
        postingPacks: result.draft.postingPacks,
        strategicBreakdown: result.draft.strategicBreakdown,
        gate: result.gate,
        status: "draft",
      });
      setS((prev) => ({ ...prev, savedId: id }));
      void refreshScripts();
    } catch (err) {
      setError(`Naskah jadi, tapi gagal disimpan ke riwayat: ${errorText(err)}`);
    }
  }

  function reset() {
    abort.current?.abort();
    setBusy(null);
    setError(null);
    setS(EMPTY);
  }

  const removeFact = (id: string) =>
    setS((prev) => (prev.brief ? { ...prev, brief: { ...prev.brief, verifiedFacts: prev.brief.verifiedFacts.filter((f) => f.id !== id) } } : prev));

  const streaming = useMemo(() => (busy === "script" ? previewScenes(raw) : []), [busy, raw]);
  const pickedHook = s.picked && s.angles?.[s.picked.a]?.hooks[s.picked.h];

  // ---------- Tampilan ----------

  if (busy === "script" || s.result || (s.picked && error)) {
    const result = s.result;
    return (
      <div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Kembali ke pilihan hook" onClick={() => setS((p) => ({ ...p, result: undefined, picked: undefined }))}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <p className="truncate text-sm text-ink-2">{s.product?.name}</p>
        </div>

        <h1 className="mt-3 text-[1.9rem] font-black leading-[1.08] tracking-[-0.03em] text-balance">“{pickedHook?.verbalHook}”</h1>

        {result ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
              <span className="num">
                ±{Math.round(result.totalEstSec)} dtk · {result.draft.scenes.length} adegan
              </span>
              <PlatformSwitch value={platform} onChange={setPlatform} options={platforms} />
            </div>
            {!result.gate.passed && (
              <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
                <p className="font-semibold text-accent">Cek sebelum rekam</p>
                <ul className="mt-1 list-disc pl-5 text-ink-2">
                  {result.gate.reasons.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button size="lg" disabled={!s.savedId} onClick={() => s.savedId && navigate(`/prompter/${s.savedId}?p=${platform}`)}>
                <Play className="h-5 w-5" aria-hidden="true" />
                Teleprompter
              </Button>
              <Button size="lg" variant="secondary" onClick={() => void copy.copy("all", scriptAsText(result.draft.scenes, platform))}>
                {copy.copied === "all" ? "Tersalin" : "Salin naskah"}
              </Button>
            </div>
            <ThroughlineSummary t={result.draft.throughline} />
            <div className="mt-8">
              <SceneList scenes={result.draft.scenes} platform={platform} />
            </div>
            <div className="mt-6">
              <PostingPack packs={result.draft.postingPacks} platform={platform} copy={copy} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setS((p) => ({ ...p, result: undefined, picked: undefined }))}>
                Pilih hook lain
              </Button>
              <Button variant="ghost" onClick={reset}>
                Produk baru
              </Button>
            </div>
            {error && <p className="mt-4 text-sm text-risk">{error}</p>}
          </>
        ) : (
          <div className="mt-8" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
              {status ?? BUSY_COPY.script}
            </p>
            <ol className="mt-6 space-y-6">
              {streaming.map((sc, i) => (
                <li key={i} className="slate-in">
                  <span className="text-sm font-extrabold uppercase tracking-[0.06em]" style={{ color: roleColor(sc.role) }}>
                    {ROLE_LABEL[sc.role ?? ""] ?? "Adegan"}
                  </span>
                  <p className="mt-1.5 text-[1.2rem] font-semibold leading-snug">
                    {sc.text}
                    {!sc.done && <span className="writing-caret ml-0.5" aria-hidden="true" />}
                  </p>
                </li>
              ))}
            </ol>
            {error && <ErrorBox message={error} onRetry={() => s.picked && void pickHook(s.picked.a, s.picked.h)} />}
          </div>
        )}
      </div>
    );
  }

  if (s.product && (busy === "hooks" || s.angles)) {
    return (
      <div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Ganti produk" onClick={reset}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <p className="text-sm text-ink-2">{CATEGORY_LABEL[s.product.category]}</p>
        </div>
        <h1 className="mt-2 text-[1.9rem] font-black leading-[1.08] tracking-[-0.03em] text-balance">{s.product.name}</h1>

        <FactList brief={s.brief} pageRead={s.pageRead} onRemove={removeFact} />
        {!!s.gaps?.length && busy === null && <GapsForm gaps={s.gaps} onSubmit={(t) => void addInfo(t)} onSkip={() => setS((p) => ({ ...p, gaps: [] }))} />}

        <div className="mt-6">
          <p className="text-sm font-semibold">Durasi</p>
          <div className="mt-2 flex gap-2">
            {(Object.keys(DURATION_PRESETS) as DurationPreset[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setS((p) => ({ ...p, duration: d }))}
                aria-pressed={s.duration === d}
                className={cn(
                  "num min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer",
                  s.duration === d ? "border-accent bg-accent text-on-accent" : "border-line-strong text-ink-2 hover:text-ink",
                )}
              >
                {DURATION_PRESETS[d].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-[-0.02em]">Pilih hook pembuka</h2>
          {s.angles && (
            <Button variant="ghost" size="sm" onClick={() => void loadHooks()} disabled={busy !== null}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Hook baru
            </Button>
          )}
        </div>

        {busy === "hooks" ? (
          <Working label={BUSY_COPY.hooks} />
        ) : (
          <div className="mt-4 space-y-8">
            {s.angles?.map((angle, a) => (
              <section key={a} aria-label={angle.angleTitle}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="font-extrabold">{angle.angleTitle}</h3>
                  <span className="text-sm text-ink-3">
                    {FORMAT_LABEL[angle.videoFormat]} · {angle.productionNeeds.showsFace ? "pakai wajah" : "tanpa wajah"}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-2">
                  {angle.hooks.map((h, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => void pickHook(a, i)}
                        className="group w-full rounded-xl border border-line bg-surface p-4 text-left transition-[border-color,transform] duration-200 ease-out hover:border-accent active:scale-[0.99] cursor-pointer"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.06em] text-accent">{HOOK_TYPE_LABEL[h.psychologyType]}</span>
                        <span className="mt-1 block text-[1.1rem] font-bold leading-snug">“{h.verbalHook}”</span>
                        <span className="mt-2 block text-sm text-ink-2">
                          <span className="text-ink-3">Aksi: </span>
                          {h.visualHook}
                        </span>
                        <span className="mt-1 block text-sm text-ink-2">
                          <span className="text-ink-3">Teks layar: </span>
                          {h.textOnScreen}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {error && <ErrorBox message={error} onRetry={() => void loadHooks()} />}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[2.1rem] font-black leading-[1.05] tracking-[-0.035em] text-balance">Produk apa hari ini?</h1>
      <p className="mt-2 text-ink-2">Tempel link TikTok Shop atau Shopee, atau share langsung dari aplikasinya.</p>

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="p-url">Link produk</Label>
          <Input
            id="p-url"
            inputMode="url"
            placeholder="https://vt.tokopedia.com/…"
            value={s.input.url}
            onChange={(e) => setS((p) => ({ ...p, input: { ...p.input, url: e.target.value } }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-name">Nama produk</Label>
          <Input
            id="p-name"
            placeholder="Kalau link tidak terbaca, mis. Nivea Lip Balm"
            value={s.input.name}
            onChange={(e) => setS((p) => ({ ...p, input: { ...p.input, name: e.target.value } }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-notes">Pengalaman kamu (opsional)</Label>
          <Textarea
            id="p-notes"
            placeholder="Sudah dipakai berapa lama, yang kamu suka, yang kurang. Bikin naskah lebih jujur dan beda."
            value={s.input.notes}
            onChange={(e) => setS((p) => ({ ...p, input: { ...p.input, notes: e.target.value } }))}
          />
        </div>
        {busy === "research" ? (
          <Working label={BUSY_COPY.research} />
        ) : (
          <Button type="submit" size="lg" className="w-full" disabled={!s.input.url.trim() && !s.input.name.trim()}>
            Cari hook
          </Button>
        )}
        {error && <ErrorBox message={error} onRetry={() => void start()} />}
      </form>
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <p className="mt-5 flex min-h-[54px] items-center gap-2.5 text-ink-2" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      {label}
    </p>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-xl border border-risk/40 bg-risk/10 p-3 text-sm">
      <p className="text-risk">{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-semibold text-ink underline cursor-pointer">
        Coba lagi
      </button>
    </div>
  );
}

function ThroughlineSummary({ t }: { t: ScriptResult["draft"]["throughline"] }) {
  return (
    <dl className="mt-6 grid gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
      <div>
        <dt className="font-semibold text-accent">Janji hook</dt>
        <dd className="mt-0.5 text-ink">{t.hookPromise}</dd>
      </div>
      <div>
        <dt className="font-semibold text-ink-3">Dibayar dengan</dt>
        <dd className="mt-0.5 text-ink-2">{t.payoff}</dd>
      </div>
      <div>
        <dt className="font-semibold text-ink-3">Alasan klik sekarang</dt>
        <dd className="mt-0.5 text-ink-2">{t.reasonToBuyNow}</dd>
      </div>
    </dl>
  );
}

function GapsForm({ gaps, onSubmit, onSkip }: { gaps: string[]; onSubmit: (text: string) => void; onSkip: () => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
      }}
    >
      <p className="font-bold text-accent">Biar naskahnya lebih menjual</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
        {gaps.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <Textarea
        aria-label="Jawaban tambahan"
        className="mt-3"
        rows={3}
        placeholder="Satu info per baris, mis. Harga Rp25 ribu di TikTok Shop"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={!text.trim()}>
          Pakai & buat hook ulang
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
          Lewati
        </Button>
      </div>
    </form>
  );
}

function FactList({ brief, pageRead, onRemove }: { brief?: BriefSnap; pageRead?: boolean; onRemove: (id: string) => void }) {
  if (!brief) return null;
  return (
    <details className="group mt-4 rounded-xl border border-line">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm">
        <span>
          <span className="font-semibold">{brief.verifiedFacts.length} fakta dipakai</span>
          <span className="text-ink-3">{pageRead ? " · halaman produk terbaca" : " · dari riset web & catatanmu"}</span>
        </span>
        <span className="text-accent group-open:hidden">Lihat</span>
        <span className="hidden text-accent group-open:inline">Tutup</span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {brief.verifiedFacts.map((f) => (
          <li key={f.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
            <span className="flex-1 text-ink-2">
              {f.text}
              {f.sourceUrl && (
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-accent underline">
                  sumber
                </a>
              )}
            </span>
            <button
              type="button"
              aria-label={`Hapus fakta: ${f.text}`}
              onClick={() => onRemove(f.id)}
              className="-mr-2 -mt-2 grid min-h-[44px] min-w-[44px] place-items-center text-ink-3 hover:text-risk cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
