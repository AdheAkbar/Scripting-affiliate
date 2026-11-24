import React, { useEffect, useState } from "react";
import { Timer, X } from "lucide-react";
import { ZodError } from "zod";
import type { BrandInput } from "../../shared/schemas";
import { FORMAT_LABEL } from "../../shared/labels";
import { useStudio } from "../contexts/StudioContext";
import { WpmReadingTestDialog } from "../components/brand/WpmReadingTestDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Textarea } from "../components/ui/textarea";
import { WPM_MAX, WPM_MIN } from "../lib/wpm-test";
import { cn } from "../lib/utils";

/** Gaya bawaan yang dikonfirmasi owner: masalah dibawakan lucu/roast -> solusi produk -> CTA. */
const ROAST_STYLE = {
  personaTone:
    "Teman tongkrongan yang lucu dan blak-blakan, pakai gua/lo. Buka dengan masalah yang dibawakan sebagai lelucon/roast situasi yang relate, lalu belok ke solusi produk dengan jujur, tutup dengan ajakan santai. Kalimat pendek, ritme cepat, tanpa bahasa iklan. Roast situasi boleh; hinaan soal gender, SARA, fisik, atau disabilitas tidak boleh.",
  styleExamples: [
    "Punya masalah bibir hitam? Walaupun punya pasangan, kalau nggak diurus ya kayak single.",
    "Mulai rawat diri sendiri aja, putusin pacar lo. Canda. Tapi bibir lo jangan.",
    "Gua rekomendasiin ini karena menurut gua beneran ngaruh buat bibir kering.",
    "Biar pas ketemu banyak orang lo kelihatan lebih fresh. Klik keranjang kuning di bawah.",
  ],
};

const FACE = [
  { value: "face", label: "Wajah" },
  { value: "faceless", label: "Tanpa wajah" },
  { value: "mixed", label: "Campur" },
] as const;

type Errors = Partial<Record<keyof BrandInput, string>>;

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer",
        active ? "border-accent bg-accent text-on-accent" : "border-line-strong text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="-mt-1 text-sm text-ink-3">{hint}</p>}
      {children}
      {error && (
        <p className="text-sm text-risk" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BrandPage() {
  const { brandInput, saveBrand, bannedPhrasesPreset } = useStudio();
  const [form, setForm] = useState<BrandInput | null>(brandInput);
  const [phrase, setPhrase] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => setForm(brandInput), [brandInput]);
  if (!form) return null;

  const set = <K extends keyof BrandInput>(k: K, v: BrandInput[K]) => {
    setForm({ ...form, [k]: v });
    setSaved(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await saveBrand(form!);
      setSaved(true);
    } catch (err) {
      if (err instanceof ZodError) {
        const next: Errors = {};
        for (const i of err.issues) next[i.path[0] as keyof BrandInput] ??= i.message;
        setErrors(next);
      } else setErrors({ accountName: err instanceof Error ? err.message : "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  }

  const addPhrase = () => {
    const p = phrase.trim();
    if (p && !form.bannedPhrases.includes(p)) set("bannedPhrases", [...form.bannedPhrases, p]);
    setPhrase("");
  };
  const platforms = form.primaryPlatforms;
  const togglePlatform = (p: "tiktok" | "shopee") =>
    set("primaryPlatforms", platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]);

  return (
    <form onSubmit={submit} className="pb-4">
      <h1 className="text-[2.1rem] font-black leading-[1.05] tracking-[-0.035em]">Gaya kamu</h1>
      <p className="mt-2 text-ink-2">Semua naskah ditulis dengan gaya ini.</p>

      <button
        type="button"
        onClick={() => setForm({ ...form, ...ROAST_STYLE })}
        className="mt-5 w-full rounded-2xl border border-accent/50 bg-accent/10 p-4 text-left transition-colors hover:bg-accent/15 cursor-pointer"
      >
        <span className="font-bold text-accent">Pakai gaya “roast lucu → solusi”</span>
        <span className="mt-1 block text-sm text-ink-2">Buka dengan masalah yang dibikin lucu, lalu produk sebagai jalan keluarnya. Gua/lo, cepat, nggak kayak iklan.</span>
      </button>

      <div className="mt-8 space-y-7">
        <Field id="b-name" label="Nama akun" error={errors.accountName}>
          <Input id="b-name" value={form.accountName} onChange={(e) => set("accountName", e.target.value)} />
        </Field>

        <Field id="b-tone" label="Cara kamu ngomong" hint="Persona, gaya bercanda, kata ganti yang dipakai." error={errors.personaTone}>
          <Textarea id="b-tone" rows={4} value={form.personaTone} onChange={(e) => set("personaTone", e.target.value)} />
        </Field>

        <Field id="b-examples" label="Contoh kalimat kamu" hint="Satu kalimat per baris, maksimal 5. Paling ngaruh ke hasil." error={errors.styleExamples}>
          <Textarea
            id="b-examples"
            rows={5}
            value={form.styleExamples.join("\n")}
            onChange={(e) =>
              set(
                "styleExamples",
                e.target.value
                  .split("\n")
                  .map((l) => l.trimStart())
                  .slice(0, 5),
              )
            }
            onBlur={() => set("styleExamples", form.styleExamples.map((l) => l.trim()).filter(Boolean))}
          />
        </Field>

        <Field id="b-aud" label="Penonton kamu" error={errors.targetAudience}>
          <Input id="b-aud" value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} />
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Rekaman</p>
          <div className="flex flex-wrap gap-2">
            {FACE.map((f) => (
              <Chip key={f.value} active={form.faceMode === f.value} onClick={() => set("faceMode", f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Platform</p>
          <div className="flex gap-2">
            <Chip active={platforms.includes("tiktok")} onClick={() => togglePlatform("tiktok")}>
              TikTok Shop
            </Chip>
            <Chip active={platforms.includes("shopee")} onClick={() => togglePlatform("shopee")}>
              Shopee Video
            </Chip>
          </div>
          {errors.primaryPlatforms && <p className="text-sm text-risk">Pilih minimal satu platform.</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Kecepatan bicara</p>
            <span className="num text-sm font-bold">{form.voiceoverWpm} kata/menit</span>
          </div>
          <Slider
            aria-label="Kecepatan bicara"
            min={WPM_MIN}
            max={WPM_MAX}
            step={5}
            value={[form.voiceoverWpm]}
            onValueChange={([v]) => set("voiceoverWpm", v!)}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setTestOpen(true)}>
            <Timer className="h-4 w-4" aria-hidden="true" />
            Ukur dengan uji baca 30 detik
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="b-ban">Kata yang tidak boleh dipakai</Label>
          <div className="flex gap-2">
            <Input
              id="b-ban"
              value={phrase}
              placeholder="mis. racun banget"
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhrase();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addPhrase}>
              Tambah
            </Button>
          </div>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {form.bannedPhrases.map((p) => (
              <li key={p} className="inline-flex items-center rounded-full border border-line pl-3 text-sm text-ink-2">
                {p}
                <button
                  type="button"
                  aria-label={`Hapus ${p}`}
                  onClick={() => set("bannedPhrases", form.bannedPhrases.filter((x) => x !== p))}
                  className="grid min-h-[36px] min-w-[36px] place-items-center text-ink-3 hover:text-risk cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {form.bannedPhrases.length === 0 && bannedPhrasesPreset.length > 0 && (
            <button type="button" onClick={() => set("bannedPhrases", bannedPhrasesPreset)} className="text-sm font-semibold text-accent underline cursor-pointer">
              Isi daftar klise affiliate bawaan
            </button>
          )}
        </div>

        <details className="rounded-xl border border-line">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm font-semibold">Lanjutan</summary>
          <div className="space-y-6 border-t border-line p-4">
            <Field id="b-vis" label="Gaya visual" error={errors.visualAesthetic}>
              <Input id="b-vis" value={form.visualAesthetic} onChange={(e) => set("visualAesthetic", e.target.value)} />
            </Field>
            <Field id="b-format" label="Format favorit">
              <select
                id="b-format"
                value={form.defaultFormat}
                onChange={(e) => set("defaultFormat", e.target.value as BrandInput["defaultFormat"])}
                className="min-h-[46px] w-full rounded-[10px] border border-line-strong bg-canvas px-3 text-ink"
              >
                <option value="auto">Bebas, pilihkan yang cocok</option>
                {Object.entries(FORMAT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-8 md:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-[0_8px_24px_rgb(0_0_0/0.45)]" disabled={saving}>
          {saving ? "Menyimpan…" : saved ? "Tersimpan" : "Simpan gaya"}
        </Button>
      </div>

      <WpmReadingTestDialog open={testOpen} onOpenChange={setTestOpen} onApplyWpm={(w) => set("voiceoverWpm", w)} />
    </form>
  );
}
