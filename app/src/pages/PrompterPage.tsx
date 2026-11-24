import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { countWords } from "../../shared/duration";
import { ROLE_LABEL } from "../../shared/labels";
import { useStudio } from "../contexts/StudioContext";
import { getScript, type ScriptDoc } from "../lib/scripts-store";
import { roleColor, sceneVo, type Platform } from "../components/script/ScriptView";

const FONT_STEPS = [28, 34, 40, 48, 56];

export function PrompterPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const platform = (params.get("p") === "shopee" ? "shopee" : "tiktok") as Platform;
  const navigate = useNavigate();
  const { scripts, brand } = useStudio();
  const [script, setScript] = useState<ScriptDoc | null>(() => scripts.find((s) => s.id === id) ?? null);
  const [missing, setMissing] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [fontIdx, setFontIdx] = useState(2);
  const scroller = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const pos = useRef(0);

  useEffect(() => {
    if (script) return;
    getScript(id)
      .then((s) => (s ? setScript(s) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [id, script]);

  const lines = useMemo(() => script?.scenes.map((s) => ({ role: s.role, text: sceneVo(s, platform) })) ?? [], [script, platform]);
  const wpm = brand?.voiceoverWpm ?? 140;
  const totalSec = useMemo(() => (lines.reduce((n, l) => n + countWords(l.text), 0) / wpm) * 60, [lines, wpm]);

  // Layar tetap menyala selama teleprompter terbuka.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, []);

  const tick = useCallback(
    (t: number) => {
      const el = scroller.current;
      if (!el) return;
      const dt = last.current === null ? 0 : (t - last.current) / 1000;
      last.current = t;
      const travel = el.scrollHeight - el.clientHeight;
      const pxPerSec = (travel / Math.max(totalSec, 1)) * speed;
      pos.current = Math.min(travel, pos.current + pxPerSec * dt);
      el.scrollTop = pos.current;
      if (pos.current >= travel) setPlaying(false);
    },
    [totalSec, speed],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = (t: number) => {
      tick(t);
      raf = requestAnimationFrame(loop);
    };
    last.current = null;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, tick]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setPlaying(true);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 800);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const toggle = () => {
    if (countdown !== null) return;
    if (playing) setPlaying(false);
    else if (pos.current <= 1) setCountdown(3);
    else setPlaying(true);
  };
  const restart = () => {
    setPlaying(false);
    pos.current = 0;
    if (scroller.current) scroller.current.scrollTop = 0;
  };

  if (missing) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
        <div>
          <p className="text-ink-2">Naskah tidak ditemukan.</p>
          <button type="button" onClick={() => navigate("/history")} className="mt-3 font-semibold text-accent underline cursor-pointer">
            Buka riwayat
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-ink">
      <div
        ref={scroller}
        onScroll={(e) => !playing && (pos.current = e.currentTarget.scrollTop)}
        onClick={toggle}
        className="relative flex-1 overflow-y-auto px-6 [scrollbar-width:none]"
        style={{ fontSize: FONT_STEPS[fontIdx] }}
      >
        <div className="h-[32dvh]" aria-hidden="true" />
        {lines.map((l, i) => (
          <p key={i} className="mx-auto mb-[1.2em] max-w-[22ch] font-semibold leading-[1.25] tracking-[-0.01em]" style={{ fontFamily: "var(--font-prompter)" }}>
            <span className="mb-1 block text-[0.38em] font-extrabold uppercase tracking-[0.08em]" style={{ color: roleColor(l.role) }}>
              {ROLE_LABEL[l.role]}
            </span>
            {l.text}
          </p>
        ))}
        <div className="h-[70dvh]" aria-hidden="true" />
      </div>

      {/* garis baca */}
      <div className="pointer-events-none absolute inset-x-0 top-[32dvh] h-px bg-accent/50" aria-hidden="true" />

      {countdown !== null && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60" aria-live="assertive">
          <span className="num text-[8rem] font-black text-accent">{countdown}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-1 border-t border-line bg-canvas px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <IconBtn label="Tutup teleprompter" onClick={() => navigate(-1)}>
          <X className="h-5 w-5" />
        </IconBtn>
        <IconBtn label="Ulang dari awal" onClick={restart}>
          <RotateCcw className="h-5 w-5" />
        </IconBtn>
        <div className="flex items-center">
          <IconBtn label="Lebih lambat" onClick={() => setSpeed((v) => Math.max(0.5, +(v - 0.1).toFixed(1)))}>
            <Minus className="h-5 w-5" />
          </IconBtn>
          <span className="num w-12 text-center text-sm font-semibold">{speed.toFixed(1)}×</span>
          <IconBtn label="Lebih cepat" onClick={() => setSpeed((v) => Math.min(2, +(v + 0.1).toFixed(1)))}>
            <Plus className="h-5 w-5" />
          </IconBtn>
        </div>
        <IconBtn label="Huruf lebih kecil" onClick={() => setFontIdx((i) => Math.max(0, i - 1))}>
          <span className="text-sm font-bold">A−</span>
        </IconBtn>
        <IconBtn label="Huruf lebih besar" onClick={() => setFontIdx((i) => Math.min(FONT_STEPS.length - 1, i + 1))}>
          <span className="text-base font-bold">A+</span>
        </IconBtn>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Jeda" : "Mulai"}
          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent cursor-pointer"
        >
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </main>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg text-ink-2 hover:bg-raised hover:text-ink cursor-pointer [&_svg]:pointer-events-none"
    >
      {children}
    </button>
  );
}
