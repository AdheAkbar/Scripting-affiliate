import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useStudio } from "../contexts/StudioContext";
import { Input } from "../components/ui/input";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

export function HistoryPage() {
  const { scripts } = useStudio();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? scripts.filter((s) => `${s.product.name} ${s.hook.verbalHook} ${s.angleTitle}`.toLowerCase().includes(needle))
      : scripts;
  }, [scripts, q]);

  return (
    <div>
      <h1 className="text-[2.1rem] font-black leading-[1.05] tracking-[-0.035em]">Riwayat</h1>

      {scripts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line p-6">
          <p className="font-bold">Belum ada naskah.</p>
          <p className="mt-1 text-ink-2">Naskah yang kamu buat tersimpan otomatis di sini. Tandai yang sudah diposting dan isi hasilnya, supaya hook berikutnya belajar dari video yang laku.</p>
          <Link to="/studio" className="mt-4 inline-block font-semibold text-accent underline">
            Buat naskah pertama
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input aria-label="Cari naskah" placeholder="Cari produk atau hook" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>
          <ul className="mt-4 divide-y divide-line">
            {shown.map((s) => (
              <li key={s.id}>
                <Link to={`/history/${s.id}`} className="block py-4 transition-colors hover:bg-surface -mx-2 px-2 rounded-lg">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold text-ink-2">{s.product.name}</span>
                    <span className="num shrink-0 text-ink-3">{dateFmt.format(new Date(s.createdAt))}</span>
                  </div>
                  <p className="mt-1 text-[1.05rem] font-bold leading-snug">“{s.hook.verbalHook}”</p>
                  <p className="num mt-1.5 text-sm">
                    {s.status === "posted" ? (
                      <span className="text-ok">
                        Diposting
                        {s.result && ` · ${s.result.views ?? 0} views · ${s.result.unitsSold ?? 0} terjual`}
                      </span>
                    ) : (
                      <span className="text-ink-3">Belum diposting · ±{Math.round(s.totalEstSec)} dtk</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="mt-6 text-ink-2">Tidak ada yang cocok dengan “{q}”.</p>}
        </>
      )}
    </div>
  );
}
