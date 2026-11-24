import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, RotateCcw, Square } from "lucide-react";
import {
  calculateMeasuredWpm,
  getReadingWords,
  READING_TEST_SECONDS,
  WPM_MAX,
  WPM_MIN,
} from "../../lib/wpm-test";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface WpmReadingTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyWpm: (wpm: number) => void;
}

type TestPhase = "ready" | "running" | "pick_word";

export function WpmReadingTestDialog({ open, onOpenChange, onApplyWpm }: WpmReadingTestDialogProps) {
  const words = useMemo(() => getReadingWords(), []);
  const [phase, setPhase] = useState<TestPhase>("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedWordCount, setSelectedWordCount] = useState<number>(words.length);
  const startedAtRef = useRef<number | null>(null);

  const reset = () => {
    startedAtRef.current = null;
    setPhase("ready");
    setElapsedMs(0);
    setSelectedWordCount(words.length);
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== "running") return;
    startedAtRef.current = performance.now();
    const interval = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const diff = performance.now() - startedAtRef.current;
      if (diff >= READING_TEST_SECONDS * 1000) {
        setElapsedMs(READING_TEST_SECONDS * 1000);
        setPhase("pick_word");
        window.clearInterval(interval);
      } else {
        setElapsedMs(diff);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [phase]);

  const elapsedSec = Math.max(1, Math.round((elapsedMs / 1000) * 10) / 10);
  const remainingSec = Math.max(0, READING_TEST_SECONDS - elapsedMs / 1000);
  const measurement = useMemo(
    () => calculateMeasuredWpm(selectedWordCount, elapsedSec),
    [selectedWordCount, elapsedSec],
  );

  function handleStopEarly() {
    if (startedAtRef.current !== null) {
      setElapsedMs(Math.max(1000, performance.now() - startedAtRef.current));
    }
    setPhase("pick_word");
  }

  function handleApply() {
    onApplyWpm(measurement.clampedWpm);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Uji Baca 30 Detik</DialogTitle>
          <DialogDescription>
            Baca teks di bawah dengan suara normal seperti merekam voiceover. Saat waktu habis (atau kamu selesai lebih cepat), ketuk kata terakhir yang kamu baca.
          </DialogDescription>
        </DialogHeader>

        {/* Timer header */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
          <div>
            <p className="text-xs text-ink-2">
              {phase === "ready" && "Siap mulai"}
              {phase === "running" && "Sisa waktu"}
              {phase === "pick_word" && "Durasi baca"}
            </p>
            <p className="num text-2xl font-semibold text-ink">
              {phase === "ready" && `${READING_TEST_SECONDS.toFixed(1)} dtk`}
              {phase === "running" && `${remainingSec.toFixed(1)} dtk`}
              {phase === "pick_word" && `${elapsedSec.toFixed(1)} dtk`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {phase === "ready" && (
              <Button type="button" onClick={() => setPhase("running")}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Mulai 30 dtk
              </Button>
            )}
            {phase === "running" && (
              <Button type="button" variant="secondary" onClick={handleStopEarly}>
                <Square className="h-4 w-4" aria-hidden="true" />
                Selesai Baca
              </Button>
            )}
            {phase === "pick_word" && (
              <Button type="button" variant="secondary" onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Ulangi
              </Button>
            )}
          </div>
        </div>

        {/* Teks bacaan 17px/1.7 (sesuai tipografi VO design.md §2) */}
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-xs text-ink-2">
            {phase === "pick_word"
              ? "Ketuk kata terakhir yang sempat kamu baca:"
              : `Naskah uji (${words.length} kata)`}
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-[17px] leading-[1.7] text-ink">
            {words.map((word, index) => {
              const count = index + 1;
              const isRead = phase === "pick_word" && count <= selectedWordCount;
              const isLast = phase === "pick_word" && count === selectedWordCount;
              if (phase === "pick_word") {
                return (
                  <button
                    key={`${word}-${index}`}
                    type="button"
                    onClick={() => setSelectedWordCount(count)}
                    className={cn(
                      "rounded px-1 transition-colors duration-150 cursor-pointer",
                      isLast
                        ? "bg-accent text-on-accent font-semibold"
                        : isRead
                          ? "bg-accent/20 text-ink"
                          : "text-ink-2 hover:bg-raised hover:text-ink",
                    )}
                  >
                    {word}
                  </button>
                );
              }
              return <span key={`${word}-${index}`}>{word}</span>;
            })}
          </div>
        </div>

        {/* Hasil hitung WPM */}
        {phase === "pick_word" && (
          <div className="mt-4 space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs text-ink-2">Kecepatan baca terukur</p>
                <p className="num text-xl font-semibold text-ink">
                  {measurement.rawWpm} WPM{" "}
                  <span className="text-xs font-normal text-ink-2">
                    ({selectedWordCount} kata / {elapsedSec.toFixed(1)} dtk)
                  </span>
                </p>
              </div>
              {measurement.wasClamped && (
                <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">
                  Disesuaikan ke {WPM_MIN}–{WPM_MAX} WPM
                </span>
              )}
            </div>

            <Button type="button" onClick={handleApply} className="w-full">
              <Check className="h-4 w-4" aria-hidden="true" />
              Pakai hasil ({measurement.clampedWpm} WPM)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
