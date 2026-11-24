import { z } from "zod";

// Enum bersama — sumber: docs/erd.md §4. Jangan ubah nilai tanpa memperbarui erd.md.
export const Platform = z.enum(["tiktok", "shopee", "reels", "shorts"]);
export const VideoFormat = z.enum([
  "talking_head",
  "faceless_vo",
  "pov",
  "before_after",
  "unboxing_first_impression",
  "comparison",
  "tutorial_demo",
  "grwm_routine",
  "listicle",
]);
export const FaceMode = z.enum(["face", "faceless", "mixed"]);
export const SellingStyle = z.enum([
  "soft_sell_cinematic",
  "educational",
  "problem_solution",
  "storytelling",
  "hard_sell",
  "honest_review",
  "comparison",
]);
export const HookType = z.enum([
  "pattern_interrupt",
  "relatable_pain",
  "contrarian",
  "proof_first",
  "curiosity_gap",
  "price_shock",
  "social_proof",
  "pov",
]);
export const PillarType = z.enum([
  "education",
  "storytelling",
  "honest_compare",
  "behind_scenes",
  "trust_building",
  "product_spotlight",
]);
export const ProductCategory = z.enum([
  "skincare_beauty",
  "fashion",
  "gadget_elektronik",
  "rumah_tangga",
  "dapur",
  "ibu_bayi",
  "kesehatan_suplemen",
  "hobi_olahraga",
  "otomotif",
  "makanan_minuman",
  "lainnya",
]);
export const Marketplace = z.enum(["tiktok_shop", "shopee", "tokopedia", "lazada", "other"]);
export const ScrapeStatus = z.enum(["pending", "success", "blocked", "manual_only"]);
export const SceneRole = z.enum(["hook", "agitate", "proof", "demo", "objection_handle", "offer", "cta"]);
export const ScriptStatus = z.enum(["draft", "ready", "recorded", "posted"]);
export const IdeaStatus = z.enum(["idea", "scripted", "published", "archived"]);
export const Awareness = z.enum(["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"]);
export const FactSource = z.enum(["user", "photo", "page", "web"]);
export const Effort = z.enum(["low", "medium", "high"]);
export const StageName = z.enum([
  "trend_pulse",
  "product_research",
  "brief_extract",
  "angles",
  "hooks",
  "script_draft",
  "audit",
  "partial_revise",
  "viral_extract",
  "ideas",
]);
export const RunStatus = z.enum(["success", "repaired", "failed", "refused"]);
