import { z } from "zod";
import { Angle, Audit, Brief, Hook, PostingPack, Scene, TrendItem } from "./documents";
import { HookType, PillarType } from "./enums";

// Skema OUTPUT LLM per tahap (dikirim sebagai JSON Schema + divalidasi Zod di server/ai/llm.ts).
// Field milik server (ownerUid, id relasi, flag UI) sengaja tidak ada: server yang menambahkannya
// lalu memvalidasi ulang dengan skema dokumen di documents.ts sebelum menulis ke Firestore.

const nonEmpty = z.string().trim().min(1);

export const TrendPulseOut = z.object({
  items: z.array(TrendItem).max(12),
  campaignMoments: z.array(z.object({ name: nonEmpty, dateRange: nonEmpty, relevance: nonEmpty })),
});

export const BriefOut = Brief.pick({
  painPoints: true,
  buyingTriggers: true,
  objections: true,
  competitorGaps: true,
  verifiedFacts: true,
  forbiddenClaims: true,
});

export const AnglesOut = z.object({
  angles: z.array(
    Angle.pick({
      angleTitle: true,
      sellingStyle: true,
      videoFormat: true,
      targetAwareness: true,
      whyItFits: true,
      trendItemRefs: true,
      productionNeeds: true,
    }),
  ),
});

export const HooksOut = z.object({
  hooks: z.array(
    Hook.pick({ psychologyType: true, verbalHook: true, visualHook: true, textOnScreen: true, inspiredBy: true }),
  ),
});

export const ScriptDraftOut = z.object({
  scenes: z.array(Scene).min(2).max(15),
  postingPacks: z.object({ tiktok: PostingPack, shopee: PostingPack }),
  strategicBreakdown: z.object({
    hookPsychology: nonEmpty,
    emotionLogicTrigger: nonEmpty,
    objectionHandling: nonEmpty,
    ctaReasoning: nonEmpty,
  }),
});

export const AuditOut = Audit;

export const ViralPatternOut = z.object({
  hookType: HookType,
  structure: z.array(nonEmpty).min(1),
  avgSceneSec: z.number().positive(),
  visualStyle: nonEmpty,
  whyItWorks: nonEmpty,
  tags: z.array(nonEmpty),
});

export const IdeasOut = z.object({
  ideas: z.array(z.object({ pillarType: PillarType, title: nonEmpty, premise: nonEmpty, brandingGoal: nonEmpty })),
});

export type TrendPulseOut = z.infer<typeof TrendPulseOut>;
export type BriefOut = z.infer<typeof BriefOut>;
export type AnglesOut = z.infer<typeof AnglesOut>;
export type HooksOut = z.infer<typeof HooksOut>;
export type ScriptDraftOut = z.infer<typeof ScriptDraftOut>;
export type AuditOut = z.infer<typeof AuditOut>;
