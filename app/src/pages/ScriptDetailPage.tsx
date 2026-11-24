import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { useStudio } from "../contexts/StudioContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PlatformSwitch, PostingPack, SceneList, scriptAsText, useCopy, type Platform } from "../components/script/ScriptView";
import { deleteScript, getScript, updateScript, type ScriptDoc } from "../lib/scripts-store";

const toInt = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.round(Number(v.replace(/\D/g, "")))));

export function ScriptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { scripts, refreshScripts } = useStudio();
  const [script, setScript] = useState<ScriptDoc | null>(() => scripts.find((s) => s.id === id) ?? null);
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [views, setViews] = useState("");
  const [sold, setSold] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const copy = useCopy();

  useEffect(() => {
    if (!script) void getScript(id).then(setScript);
  }, [id, script]);
  useEffect(() => {
    if (!script) return;
    setViews(script.result?.views?.toString() ?? "");
    setSold(script.result?.unitsSold?.toString() ?? "");
    setPlatform((script.platforms.find((p) => p === "tiktok" || p === "shopee") as Platform) ?? "tiktok");
  }, [script]);

  if (!script) return <p className="text-ink-2">Memuat naskah…</p>;
  const platforms = script.platforms.filter((p): p is Platform => p === "tiktok" || p === "shopee");

  async function saveResult() {
    setSaving(true);
    setMsg(null);
    try {
      const result = { views: toInt(views), unitsSold: toInt(sold) };
      await updateScript(script!.id, { status: "posted", result });
      setScript({ ...script!, status: "posted", result });
      setMsg("Tersimpan. Naskah yang laku dipakai sebagai contoh untuk hook berikutnya.");
      void refreshScripts();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Hapus naskah ini dari riwayat?")) return;
    await deleteScript(script!.id);
    await refreshScripts();
    navigate("/history", { replace: true });
  }

  return (
    <div>
      <Button variant="ghost" size="icon" aria-label="Kembali ke riwayat" onClick={() => navigate("/history")}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Button>
      <p className="mt-2 text-sm text-ink-2">{script.product.name}</p>
      <h1 className="mt-1 text-[1.9rem] font-black leading-[1.08] tracking-[-0.03em] text-balance">“{script.hook.verbalHook}”</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
        <span className="num">
          ±{Math.round(script.totalEstSec)} dtk · {script.scenes.length} adegan
        </span>
        <PlatformSwitch value={platform} onChange={setPlatform} options={platforms} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => navigate(`/prompter/${script.id}?p=${platform}`)}>
          <Play className="h-5 w-5" aria-hidden="true" />
          Teleprompter
        </Button>
        <Button size="lg" variant="secondary" onClick={() => void copy.copy("all", scriptAsText(script.scenes, platform))}>
          {copy.copied === "all" ? "Tersalin" : "Salin naskah"}
        </Button>
      </div>

      <section aria-labelledby="hasil" className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <h2 id="hasil" className="font-bold">
          {script.status === "posted" ? "Hasil video" : "Sudah diposting?"}
        </h2>
        <p className="mt-1 text-sm text-ink-2">Isi angka kasarnya saja. Video yang laku jadi contoh gaya untuk naskah berikutnya.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-views">Views</Label>
            <Input id="r-views" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-sold">Terjual</Label>
            <Input id="r-sold" inputMode="numeric" value={sold} onChange={(e) => setSold(e.target.value)} placeholder="0" />
          </div>
        </div>
        <Button className="mt-3 w-full" variant={script.status === "posted" ? "secondary" : "default"} disabled={saving} onClick={() => void saveResult()}>
          {saving ? "Menyimpan…" : script.status === "posted" ? "Perbarui hasil" : "Tandai sudah diposting"}
        </Button>
        {msg && <p className="mt-2 text-sm text-ink-2">{msg}</p>}
      </section>

      <div className="mt-8">
        <SceneList scenes={script.scenes} platform={platform} />
      </div>
      <div className="mt-6">
        <PostingPack packs={script.postingPacks} platform={platform} copy={copy} />
      </div>

      <Button variant="danger" className="mt-8" onClick={() => void remove()}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Hapus naskah
      </Button>
    </div>
  );
}
