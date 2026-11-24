import { z } from "zod";
import {
  Awareness, Effort, FaceMode, FactSource, HookType, IdeaStatus, Marketplace, PillarType, Platform,
  ProductCategory, RunStatus, SceneRole, ScrapeStatus, ScriptStatus, SellingStyle, StageName, VideoFormat,
} from "./enums";

// Skema dokumen Firestore — sumber: docs/erd.md §3.
// Field timestamp (createdAt, updatedAt, checkedAt, postedAt, observedAt, expiresAt) TIDAK ada di sini:
// helper tulis server menambahkannya dengan serverTimestamp() / Timestamp agar skema sama di client & server.

const nonEmpty = z.string().trim().min(1);
const url = z.string().url();
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const AppConfig = z.object({
  ownerEmail: z.string().email(),
  monthlyBudgetUsd: z.number().positive().default(10),
  activeBrandId: z.string().optional(),
});

export const Brand = z.object({
  ownerUid: nonEmpty,
  accountName: nonEmpty,
  personaTone: nonEmpty,
  visualAesthetic: nonEmpty,
  targetAudience: nonEmpty,
  primaryPlatforms: z.array(Platform).min(1).default(["tiktok", "shopee"]),
  defaultFormat: z.union([VideoFormat, z.literal("auto")]).default("auto"),
  faceMode: FaceMode.default("mixed"),
  voiceoverWpm: z.number().int().min(110).max(180).default(140),
  bannedPhrases: z.array(nonEmpty).default([]),
  contentPillars: z.array(PillarType).default([]),
  styleExamples: z.array(nonEmpty).max(5).default([]),
  cachedSystemBlock: z.string().optional(), // dibangun server
  cachedSystemBlockTokens: z.number().int().nonnegative().optional(),
});

export const Product = z
  .object({
    ownerUid: nonEmpty,
    brandId: nonEmpty,
    name: nonEmpty,
    category: ProductCategory,
    sourceUrl: url.optional(),
    marketplace: Marketplace.optional(),
    priceIdr: z.number().int().nonnegative().optional(),
    strikePriceIdr: z.number().int().nonnegative().optional(),
    commissionPct: z.number().min(0).max(100).optional(),
    promoNotes: z.string().optional(),
    scrapeStatus: ScrapeStatus.default("manual_only"),
    scrapedSpecs: z.record(z.string(), z.unknown()).default({}),
    photoPaths: z.array(nonEmpty).max(5).default([]),
    manualDescription: z.string().default(""),
    creatorNotes: nonEmpty, // wajib: minimal 1 pengalaman nyata
  })
  .refine(
    (p) => p.manualDescription.trim() !== "" || p.photoPaths.length > 0 || p.scrapeStatus === "success",
    { message: "Isi deskripsi atau tambahkan foto jika link tidak bisa dibaca", path: ["manualDescription"] },
  );

export const TrendItem = z.object({
  kind: z.enum(["format", "hook_pattern", "audio", "topic", "buyer_question"]),
  title: nonEmpty,
  description: nonEmpty,
  exampleStructure: z.string().optional(),
  sourceUrl: url, // wajib: item tanpa sumber dibuang
});

export const TrendSnapshot = z.object({
  ownerUid: nonEmpty,
  category: ProductCategory,
  platform: Platform,
  items: z.array(TrendItem),
  campaignMoments: z.array(z.object({ name: nonEmpty, dateRange: nonEmpty, relevance: nonEmpty })).default([]),
});

export const ViralReference = z
  .object({
    ownerUid: nonEmpty,
    brandId: nonEmpty,
    url: url.optional(),
    pastedText: z.string().optional(),
    extractedPattern: z
      .object({
        hookType: HookType,
        structure: z.array(nonEmpty).min(1),
        avgSceneSec: z.number().positive(),
        visualStyle: nonEmpty,
        whyItWorks: nonEmpty,
      })
      .optional(), // diisi server setelah analisis
    tags: z.array(nonEmpty).default([]),
  })
  .refine((v) => Boolean(v.url) || Boolean(v.pastedText?.trim()), {
    message: "Isi link atau tempel teks/transkrip",
    path: ["url"],
  });

export const VerifiedFact = z.object({
  id: nonEmpty,
  text: nonEmpty,
  source: FactSource,
  sourceUrl: url.optional(),
});

export const Brief = z.object({
  ownerUid: nonEmpty,
  productId: nonEmpty,
  trendSnapshotId: z.string().optional(),
  painPoints: z.array(nonEmpty),
  buyingTriggers: z.array(nonEmpty),
  objections: z.array(nonEmpty),
  competitorGaps: z.array(nonEmpty),
  verifiedFacts: z.array(VerifiedFact).min(1, "Minimal 1 fakta produk"),
  forbiddenClaims: z.array(nonEmpty).default([]),
  rawSources: z.array(z.object({ url, title: z.string() })).default([]),
  editedByOwner: z.boolean().default(false),
  factsLocked: z.boolean().default(false),
});

export const Angle = z.object({
  ownerUid: nonEmpty,
  briefId: nonEmpty,
  productId: nonEmpty,
  angleTitle: nonEmpty,
  sellingStyle: SellingStyle,
  videoFormat: VideoFormat,
  targetAwareness: Awareness,
  whyItFits: nonEmpty,
  trendItemRefs: z.array(nonEmpty).default([]),
  productionNeeds: z.object({
    showsFace: z.boolean(),
    needsPhysicalProduct: z.boolean(),
    location: z.string().optional(),
  }),
  isSelected: z.boolean().default(false),
});

export const Hook = z.object({
  ownerUid: nonEmpty,
  angleId: nonEmpty,
  productId: nonEmpty,
  psychologyType: HookType,
  verbalHook: nonEmpty.refine((s) => wordCount(s) <= 12, "Hook ucapan maksimal 12 kata"),
  visualHook: nonEmpty,
  textOnScreen: nonEmpty.refine((s) => wordCount(s) <= 6, "Teks layar maksimal 6 kata"),
  inspiredBy: z.string().optional(),
  isFavorite: z.boolean().default(false),
});

const CtaVariant = z.object({ voiceoverText: nonEmpty, onScreenText: z.string().optional() });

export const Scene = z.object({
  order: z.number().int().positive(),
  role: SceneRole,
  durationSec: z.number().positive(),
  voiceoverText: nonEmpty,
  onScreenText: z.string().optional(),
  shot: z.object({ cameraAngle: nonEmpty, movement: z.string().optional(), props: z.string().optional() }),
  brollCue: nonEmpty,
  sfxCue: z.string().optional(),
  transitionNote: z.string().optional(),
  factIds: z.array(nonEmpty).default([]),
  // partialRecord: di Zod 4, z.record(enum) mewajibkan SEMUA key enum
  ctaVariants: z.partialRecord(Platform, CtaVariant).optional(),
});

export const Finding = z.object({
  sceneOrder: z.number().int().positive().optional(),
  quote: nonEmpty,
  problem: nonEmpty,
  severity: z.enum(["warn", "risk"]),
  suggestedFix: nonEmpty,
});

export const Audit = z.object({
  clicheFlags: z.array(Finding),
  policyRisks: z.array(Finding),
  fidelityWarnings: z.array(Finding),
  passed: z.boolean(),
});

export const PostingPack = z.object({
  caption: nonEmpty,
  hashtags: z.array(z.string().regex(/^#\S+$/, "Hashtag harus diawali # tanpa spasi")).min(3).max(6),
  pinnedComment: nonEmpty,
});

export const Script = z
  .object({
    ownerUid: nonEmpty,
    productId: nonEmpty,
    angleId: nonEmpty,
    rootScriptId: nonEmpty,
    parentVersionId: z.string().optional(),
    versionNo: z.number().int().positive(),
    revisionReason: z.string().optional(),
    selectedHookId: z.string().optional(),
    platformTargets: z.array(Platform).min(1).default(["tiktok", "shopee"]),
    videoFormat: VideoFormat,
    targetDurationSec: z.object({ min: z.number().positive(), max: z.number().positive() }),
    totalEstSec: z.number().nonnegative(),
    scenes: z.array(Scene).min(2).max(15),
    postingPacks: z.partialRecord(Platform, PostingPack), // kelengkapan per platformTargets dicek di superRefine
    strategicBreakdown: z.object({
      hookPsychology: nonEmpty,
      emotionLogicTrigger: nonEmpty,
      objectionHandling: nonEmpty,
      ctaReasoning: nonEmpty,
    }),
    factsSnapshot: z.array(VerifiedFact),
    audit: Audit.optional(),
    status: ScriptStatus.default("draft"),
  })
  .superRefine((s, ctx) => {
    s.scenes.forEach((scene, i) => {
      if (scene.order !== i + 1) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "order"], message: "Urutan adegan harus 1..n berurutan" });
      }
      if (scene.role === "cta") {
        for (const p of s.platformTargets) {
          if (!scene.ctaVariants?.[p]) {
            ctx.addIssue({ code: "custom", path: ["scenes", i, "ctaVariants", p], message: `CTA untuk ${p} wajib ada` });
          }
        }
      }
    });
    if (s.scenes[0]?.role !== "hook") {
      ctx.addIssue({ code: "custom", path: ["scenes", 0, "role"], message: "Adegan pertama harus hook" });
    }
    for (const p of s.platformTargets) {
      if (!s.postingPacks[p]) {
        ctx.addIssue({ code: "custom", path: ["postingPacks", p], message: `Posting pack ${p} wajib ada` });
      }
    }
    if (s.status === "ready" && !s.audit?.passed) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "Status ready hanya jika audit lolos" });
    }
    const factIdSet = new Set(s.factsSnapshot.map((f) => f.id));
    s.scenes.forEach((scene, i) =>
      scene.factIds.forEach((id, j) => {
        if (!factIdSet.has(id)) {
          ctx.addIssue({ code: "custom", path: ["scenes", i, "factIds", j], message: `Fakta ${id} tidak ada di factsSnapshot` });
        }
      }),
    );
  });

export const PerformanceLog = z.object({
  ownerUid: nonEmpty,
  scriptId: nonEmpty,
  productId: nonEmpty,
  platform: Platform,
  postUrl: url.optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  productClicks: z.number().int().nonnegative().optional(),
  unitsSold: z.number().int().nonnegative().optional(),
  commissionIdr: z.number().int().nonnegative().optional(),
  score: z.number().nonnegative().optional(), // dihitung server
  isWinning: z.boolean().optional(), // dihitung server
});

export const Idea = z.object({
  ownerUid: nonEmpty,
  brandId: nonEmpty,
  productId: z.string().optional(),
  pillarType: PillarType,
  title: nonEmpty,
  premise: nonEmpty,
  brandingGoal: nonEmpty,
  status: IdeaStatus.default("idea"),
});

export const ApiRun = z.object({
  ownerUid: nonEmpty,
  entityType: nonEmpty,
  entityId: nonEmpty,
  stageName: StageName,
  modelName: nonEmpty,
  effort: Effort,
  escalatedFrom: z.string().optional(),
  qualityGate: z.object({ passed: z.boolean(), reasons: z.array(z.string()) }).optional(),
  inputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  webSearchCount: z.number().int().nonnegative(),
  estCostUsd: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  status: RunStatus,
  errorMessage: z.string().optional(),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export type Brand = z.infer<typeof Brand>;
export type Product = z.infer<typeof Product>;
export type Brief = z.infer<typeof Brief>;
export type Script = z.infer<typeof Script>;
export type Scene = z.infer<typeof Scene>;
export type ApiRun = z.infer<typeof ApiRun>;
