import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import type { TrendIdeasOut } from "../../shared/schemas";
import { CATEGORY_LABEL } from "../../shared/labels";
import { useStudio } from "../contexts/StudioContext";
import { Button } from "../components/ui/button";
import { studioApi } from "../lib/studio-api";
import { useSessionState } from "../lib/use-session-state";
import { cn } from "../lib/utils";

type Idea = TrendIdeasOut["ideas"][number];

export function TrendsPage() {
  const { brandInput } = useStudio();
  const navigate = useNavigate();
  const [category, setCategory] = useSessionState("trend-cat", "skincare_beauty");
  const [ideas, setIdeas] = useSessionState<Idea[] | null>("trend-ideas", null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!brandInput) return;
    setBusy(true);
    setError(null);
    try {
      setIdeas((await studioApi.trends(brandInput, category)).ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencari ide.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[2.1rem] font-black leading-[1.05] tracking-[-0.035em]">Ide hari ini</h1>
      <p className="mt-2 text-ink-2">Dari riset web minggu ini. Pilih kategori, lalu jadikan naskah sekali tap.</p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => {
              setCategory(value);
              setIdeas(null);
            }}
            className={cn(
              "min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer",
              category === value ? "border-accent bg-accent text-on-accent" : "border-line-strong text-ink-2 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {busy ? (
        <p className="mt-6 flex items-center gap-2.5 text-ink-2" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
          Mencari yang lagi ramai…
        </p>
      ) : (
        !ideas && (
          <Button size="lg" className="mt-6 w-full" onClick={() => void load()}>
            Cari ide {CATEGORY_LABEL[category]?.toLowerCase()}
          </Button>
        )
      )}
      {error && <p className="mt-4 rounded-xl border border-risk/40 bg-risk/10 p-3 text-sm text-risk">{error}</p>}

      {ideas && !busy && (
        <>
          {ideas.length === 0 ? (
            <p className="mt-6 text-ink-2">Belum ketemu tren yang jelas untuk kategori ini. Coba kategori lain atau nanti lagi.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {ideas.map((idea, i) => (
                <li key={i} className="slate-in rounded-2xl border border-line bg-surface p-4" style={{ animationDelay: `${i * 50}ms` }}>
                  <p className="text-sm font-semibold text-ink-3">{idea.productType}</p>
                  <h2 className="mt-0.5 text-lg font-extrabold leading-snug">{idea.title}</h2>
                  <p className="mt-2 text-[1.05rem] font-semibold">“{idea.hook}”</p>
                  <p className="mt-2 text-sm text-ink-2">{idea.why}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Sumber
                    </a>
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(`/studio?${new URLSearchParams({ name: idea.productType, notes: `Ide: ${idea.angle} Hook: ${idea.hook}` })}`)
                      }
                    >
                      Jadikan naskah
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" className="mt-4" onClick={() => void load()}>
            Cari lagi
          </Button>
        </>
      )}
    </div>
  );
}
