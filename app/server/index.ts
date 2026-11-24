import fs from "node:fs";
import path from "node:path";
import express, { type Router } from "express";
import { Brand } from "../shared/schemas";
import { monthKeyJakarta } from "../shared/duration";
import { buildSystemPrompt } from "./ai/prompts";
import { requireOwnerAuth } from "./auth";
import { createStudioRouter } from "./studio";

interface BrandPresetFile {
  appConfig: {
    ownerEmail: string;
    monthlyBudgetUsd: number;
  };
  brand: {
    accountName: string;
    personaTone: string;
    visualAesthetic: string;
    targetAudience: string;
    primaryPlatforms: ("tiktok" | "shopee" | "reels" | "shorts")[];
    defaultFormat:
      | "auto"
      | "talking_head"
      | "faceless_vo"
      | "pov"
      | "before_after"
      | "unboxing_first_impression"
      | "comparison"
      | "tutorial_demo"
      | "grwm_routine"
      | "listicle";
    faceMode: "face" | "faceless" | "mixed";
    voiceoverWpm: number;
    contentPillars: (
      | "honest_compare"
      | "education"
      | "product_spotlight"
      | "trust_building"
      | "storytelling"
      | "behind_scenes"
    )[];
    styleExamples: string[];
    bannedPhrases: string[];
  };
}

let cachedPreset: BrandPresetFile | null = null;

function loadBrandPreset(): BrandPresetFile {
  if (cachedPreset) return cachedPreset;
  const presetPath = path.resolve(process.cwd(), "seed", "brand-preset.json");
  cachedPreset = JSON.parse(fs.readFileSync(presetPath, "utf-8")) as BrandPresetFile;
  return cachedPreset;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const SystemPromptInput = Brand.omit({
  ownerUid: true,
  cachedSystemBlock: true,
  cachedSystemBlockTokens: true,
});

export function createApiRouter(): Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, phase: 0, auth: "firebase" });
  });

  // Semua route di bawah wajib Firebase ID token valid + email allowlist OWNER_EMAIL
  router.use((req, res, next) => {
    void requireOwnerAuth(req, res, next);
  });

  router.get("/me", (req, res) => {
    const owner = req.owner!;
    const preset = loadBrandPreset();
    res.json({
      owner,
      monthKey: monthKeyJakarta(),
      preset: {
        appConfig: preset.appConfig,
        brand: preset.brand,
      },
    });
  });

  router.use("/studio", createStudioRouter());

  router.post("/brand/system-prompt", (req, res) => {
    const parsed = SystemPromptInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "Data brand belum valid untuk membangun system prompt.",
        issues: parsed.error.issues,
      });
      return;
    }

    const cachedSystemBlock = buildSystemPrompt({
      accountName: parsed.data.accountName,
      personaTone: parsed.data.personaTone,
      visualAesthetic: parsed.data.visualAesthetic,
      targetAudience: parsed.data.targetAudience,
      faceMode: parsed.data.faceMode,
      voiceoverWpm: parsed.data.voiceoverWpm,
      bannedPhrases: parsed.data.bannedPhrases,
      contentPillars: parsed.data.contentPillars,
      styleExamples: parsed.data.styleExamples,
    });

    res.json({
      cachedSystemBlock,
      cachedSystemBlockTokens: estimateTokens(cachedSystemBlock),
    });
  });

  return router;
}
