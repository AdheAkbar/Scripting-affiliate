import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Scene, ScriptDraftOut } from "../../../shared/schemas";
import { PLATFORM_LABEL, ROLE_LABEL } from "../../../shared/labels";
import { cn } from "../../lib/utils";

export type Platform = "tiktok" | "shopee";

export function roleColor(role?: string) {
  return `var(--color-role-${role ?? "cta"})`;
}

export function sceneVo(scene: Scene, platform: Platform): string {
  return scene.role === "cta" ? (scene.ctaVariants?.[platform]?.voiceoverText ?? scene.voiceoverText) : scene.voiceoverText;
}

export function scriptAsText(scenes: Scene[], platform: Platform): string {
  return scenes
    .map((s) => {
      const doing = [s.shot.cameraAngle, s.shot.movement, s.brollCue].filter(Boolean).join(" · ");
      const onScreen = s.role === "cta" ? (s.ctaVariants?.[platform]?.onScreenText ?? s.onScreenText) : s.onScreenText;
      return `${s.order}. ${ROLE_LABEL[s.role] ?? s.role}\nLakukan: ${doing}${onScreen ? `\nTeks layar: ${onScreen}` : ""}\nUcap: ${sceneVo(s, platform)}`;
    })
    .join("\n\n");
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    },
  };
}

export function CopyButton({ label, text, id, copy }: { label: string; text: string; id: string; copy: ReturnType<typeof useCopy> }) {
  const done = copy.copied === id;
  return (
    <button
      type="button"
      onClick={() => void copy.copy(id, text)}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-raised cursor-pointer"
    >
      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {done ? "Tersalin" : label}
    </button>
  );
}

export function PlatformSwitch({ value, onChange, options }: { value: Platform; onChange: (p: Platform) => void; options: Platform[] }) {
  if (options.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Platform" className="inline-flex rounded-lg border border-line p-0.5">
      {options.map((p) => (
        <button
          key={p}
          role="radio"
          aria-checked={value === p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "min-h-[40px] rounded-md px-3.5 text-sm font-semibold transition-colors cursor-pointer",
            value === p ? "bg-raised text-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          {PLATFORM_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function SceneSlate({ scene, platform, index }: { scene: Scene; platform: Platform; index: number }) {
  const onScreen = scene.role === "cta" ? (scene.ctaVariants?.[platform]?.onScreenText ?? scene.onScreenText) : scene.onScreenText;
  const doing = [scene.shot.cameraAngle, scene.shot.movement, scene.shot.props && `properti: ${scene.shot.props}`, scene.brollCue]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="slate-in py-5 first:pt-0" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-baseline gap-2.5">
        <span className="num text-sm font-bold text-ink-3">{String(scene.order).padStart(2, "0")}</span>
        <span className="text-sm font-extrabold uppercase tracking-[0.06em]" style={{ color: roleColor(scene.role) }}>
          {ROLE_LABEL[scene.role] ?? scene.role}
        </span>
        <span className="num ml-auto text-xs text-ink-3">±{Math.round(scene.durationSec)} dtk</span>
      </div>
      <p className="mt-2 text-[1.2rem] font-semibold leading-snug text-pretty">{sceneVo(scene, platform)}</p>
      <dl className="mt-3 grid gap-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-[4.5rem] shrink-0 text-ink-3">Lakukan</dt>
          <dd className="text-ink-2">{doing}</dd>
        </div>
        {onScreen && (
          <div className="flex gap-2">
            <dt className="w-[4.5rem] shrink-0 text-ink-3">Teks layar</dt>
            <dd className="font-semibold text-ink">{onScreen}</dd>
          </div>
        )}
        {scene.sfxCue && (
          <div className="flex gap-2">
            <dt className="w-[4.5rem] shrink-0 text-ink-3">Suara</dt>
            <dd className="text-ink-2">{scene.sfxCue}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

export function SceneList({ scenes, platform }: { scenes: Scene[]; platform: Platform }) {
  return (
    <ol className="divide-y divide-line">
      {scenes.map((s, i) => (
        <SceneSlate key={s.order} scene={s} platform={platform} index={i} />
      ))}
    </ol>
  );
}

export function PostingPack({ packs, platform, copy }: { packs: ScriptDraftOut["postingPacks"]; platform: Platform; copy: ReturnType<typeof useCopy> }) {
  const pack = packs[platform];
  const caption = `${pack.caption}\n\n${pack.hashtags.join(" ")}`;
  return (
    <section aria-labelledby="pack-title" className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="pack-title" className="font-bold">
          Caption {PLATFORM_LABEL[platform]}
        </h3>
        <CopyButton label="Salin" text={caption} id={`cap-${platform}`} copy={copy} />
      </div>
      <p className="mt-2 whitespace-pre-line text-ink-2">{pack.caption}</p>
      <p className="mt-2 text-sm font-semibold text-accent">{pack.hashtags.join(" ")}</p>
      <div className="mt-4 flex items-start justify-between gap-2 border-t border-line pt-3">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">Komentar sematan: </span>
          {pack.pinnedComment}
        </p>
        <CopyButton label="Salin" text={pack.pinnedComment} id={`pin-${platform}`} copy={copy} />
      </div>
    </section>
  );
}
