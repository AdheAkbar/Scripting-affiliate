import { z } from "zod";
import { Platform, SceneRole, SellingStyle } from "./enums";
import type { Script } from "./documents";

// Kontrak ekspor Remotion v1.0 — docs/erd.md §7. Diturunkan dari scripts.scenes, tidak disimpan.
const RemotionScene = z.object({
  scene_order: z.number().int().positive(),
  scene_role: SceneRole,
  start_sec: z.number().nonnegative(),
  duration_sec: z.number().positive(),
  voiceover_text: z.string().trim().min(1),
  on_screen_text: z.string().optional(),
  broll_prompt_cue: z.string().trim().min(1),
  camera_angle: z.string().optional(),
  sfx_cue: z.string().optional(),
  transition_note: z.string().optional(),
});

export const RemotionExport = z
  .object({
    schema_version: z.literal("1.0"),
    meta: z.object({
      script_id: z.string().min(1),
      version_no: z.number().int().positive(),
      platform: Platform,
      aspect_ratio: z.literal("9:16"),
      fps: z.number().int().positive(),
      total_duration_sec: z.number().positive(),
      brand_aesthetic: z.string(),
    }),
    product: z.object({
      name: z.string().min(1),
      selling_style: SellingStyle,
      strict_fidelity_notes: z.array(z.string()),
    }),
    scenes: z.array(RemotionScene).min(1),
  })
  .superRefine((doc, ctx) => {
    let expected = 0;
    doc.scenes.forEach((s, i) => {
      if (Math.abs(s.start_sec - expected) > 0.01) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "start_sec"], message: `start_sec harus ${expected}` });
      }
      expected += s.duration_sec;
    });
  });

export type RemotionExport = z.infer<typeof RemotionExport>;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toRemotionExport(
  script: Script & { id: string },
  opts: { platform: z.infer<typeof Platform>; productName: string; sellingStyle: z.infer<typeof SellingStyle>; brandAesthetic: string },
): RemotionExport {
  let start = 0;
  const scenes = script.scenes.map((s) => {
    const cta = s.role === "cta" ? s.ctaVariants?.[opts.platform] : undefined;
    const row = {
      scene_order: s.order,
      scene_role: s.role,
      start_sec: round1(start),
      duration_sec: s.durationSec,
      voiceover_text: cta?.voiceoverText ?? s.voiceoverText,
      on_screen_text: cta?.onScreenText ?? s.onScreenText,
      broll_prompt_cue: s.brollCue,
      camera_angle: s.shot.cameraAngle,
      sfx_cue: s.sfxCue,
      transition_note: s.transitionNote,
    };
    start += s.durationSec;
    return row;
  });
  return RemotionExport.parse({
    schema_version: "1.0",
    meta: {
      script_id: script.id,
      version_no: script.versionNo,
      platform: opts.platform,
      aspect_ratio: "9:16",
      fps: 30,
      total_duration_sec: round1(start),
      brand_aesthetic: opts.brandAesthetic,
    },
    product: {
      name: opts.productName,
      selling_style: opts.sellingStyle,
      strict_fidelity_notes: script.factsSnapshot.map((f) => f.text),
    },
    scenes,
  });
}
