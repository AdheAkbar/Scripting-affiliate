import { z } from "zod";
import { Angle, Brand, Brief, Hook, Scene, VerifiedFact } from "./documents";
import { Platform, ProductCategory } from "./enums";
import { ScriptDraftOut } from "./ai-outputs";

// Alur V1 yang disederhanakan: produk -> riset+brief (1 panggilan) -> angle+hook (1 panggilan) -> naskah (stream).

const nonEmpty = z.string().trim().min(1);
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Data brand yang dikirim client ke server (tanpa field milik server). */
export const BrandInput = Brand.omit({ ownerUid: true, cachedSystemBlock: true, cachedSystemBlockTokens: true });

export const ProductInput = z
  .object({
    url: z.string().url().optional(),
    name: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(), // pengalaman pribadi / info tambahan owner
  })
  .refine((p) => Boolean(p.url || p.name), { message: "Isi link atau nama produk", path: ["url"] });

/** Output LLM tahap riset: identitas produk + brief. */
export const ResearchOut = Brief.pick({
  painPoints: true,
  buyingTriggers: true,
  objections: true,
  verifiedFacts: true,
  forbiddenClaims: true,
}).extend({
  productName: nonEmpty,
  category: ProductCategory,
  priceIdr: z.number().int().nonnegative().optional(),
  /** Info penting yang tidak ditemukan; ditanyakan ke owner (mis. "Berapa harganya sekarang?"). */
  gaps: z.array(nonEmpty).max(3).default([]),
});

export const HookOption = Hook.pick({ psychologyType: true, verbalHook: true, visualHook: true, textOnScreen: true });

export const AngleHooksOut = z.object({
  angles: z
    .array(
      Angle.pick({ angleTitle: true, sellingStyle: true, videoFormat: true, whyItFits: true, productionNeeds: true }).extend({
        hooks: z.array(HookOption).min(2).max(4),
      }),
    )
    .min(2)
    .max(4),
});

export const TrendIdeasOut = z.object({
  ideas: z
    .array(
      z.object({
        title: nonEmpty,
        productType: nonEmpty,
        angle: nonEmpty,
        hook: nonEmpty.refine((s) => wordCount(s) <= 14, "Hook maksimal 14 kata"),
        why: nonEmpty,
        sourceUrl: z.string().url(),
      }),
    )
    .max(6),
});

/** Benang merah: ditulis model SEBELUM adegan (urutan properti = urutan tulis), adegan diturunkan darinya. */
export const Throughline = z.object({
  coreProblem: nonEmpty, // satu masalah spesifik penonton
  hookPromise: nonEmpty, // janji/loop yang dibuka hook
  payoff: nonEmpty, // bukti yang membayar janji itu (dari fakta)
  reasonToBuyNow: nonEmpty, // alasan konkret klik sekarang (dari fakta, tanpa urgensi palsu)
  ctaTieBack: nonEmpty, // kalimat CTA yang menyambung balik ke janji hook
});

export const ScriptOutV1 = z.object({
  throughline: Throughline,
  scenes: ScriptDraftOut.shape.scenes,
  postingPacks: ScriptDraftOut.shape.postingPacks,
  strategicBreakdown: ScriptDraftOut.shape.strategicBreakdown,
});

export const DURATION_PRESETS = {
  short: { min: 20, max: 30, label: "20–30 dtk" },
  medium: { min: 30, max: 45, label: "30–45 dtk" },
  long: { min: 45, max: 60, label: "45–60 dtk" },
} as const;
export const DurationPreset = z.enum(["short", "medium", "long"]);

const ProductSnapshot = z.object({
  name: nonEmpty,
  category: ProductCategory,
  url: z.string().url().optional(),
  priceIdr: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const BriefSnapshot = ResearchOut.omit({ productName: true, category: true, priceIdr: true, gaps: true });

export const ResearchRequest = z.object({ brand: BrandInput, product: ProductInput });

export const HooksRequest = z.object({
  brand: BrandInput,
  product: ProductSnapshot,
  brief: BriefSnapshot,
  winning: z.array(z.string().max(400)).max(5).default([]),
});

export const ScriptRequest = HooksRequest.extend({
  angle: AngleHooksOut.shape.angles.element.omit({ hooks: true }),
  hook: HookOption,
  duration: DurationPreset.default("medium"),
  platforms: z.array(Platform).min(1).default(["tiktok", "shopee"]),
});

export const TrendsRequest = z.object({ brand: BrandInput, category: ProductCategory });

/** Dokumen `scripts` di Firestore (riwayat). */
export const SavedScript = z.object({
  ownerUid: nonEmpty,
  product: ProductSnapshot,
  facts: z.array(VerifiedFact),
  angleTitle: nonEmpty,
  hook: HookOption,
  platforms: z.array(Platform).min(1),
  targetDurationSec: z.object({ min: z.number().positive(), max: z.number().positive() }),
  totalEstSec: z.number().nonnegative(),
  throughline: Throughline.optional(),
  scenes: z.array(Scene).min(2),
  postingPacks: ScriptDraftOut.shape.postingPacks,
  strategicBreakdown: ScriptDraftOut.shape.strategicBreakdown,
  gate: z.object({ passed: z.boolean(), reasons: z.array(z.string()) }),
  status: z.enum(["draft", "posted"]).default("draft"),
  result: z
    .object({
      views: z.number().int().nonnegative().optional(),
      unitsSold: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type BrandInput = z.infer<typeof BrandInput>;
export type ProductInput = z.infer<typeof ProductInput>;
export type ResearchOut = z.infer<typeof ResearchOut>;
export type AngleHooksOut = z.infer<typeof AngleHooksOut>;
export type HookOption = z.infer<typeof HookOption>;
export type TrendIdeasOut = z.infer<typeof TrendIdeasOut>;
export type DurationPreset = z.infer<typeof DurationPreset>;
export type ScriptRequest = z.infer<typeof ScriptRequest>;
export type SavedScript = z.infer<typeof SavedScript>;
export type ScriptOutV1 = z.infer<typeof ScriptOutV1>;
export type Throughline = z.infer<typeof Throughline>;
