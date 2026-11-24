import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useStudio } from "../../contexts/StudioContext";
import { Button } from "../ui/button";

export function LoginScreen() {
  const { accessDeniedEmail, authError, clearAccessDenied, signInWithGoogle } = useStudio();
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col justify-between bg-canvas px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-lg font-black text-on-accent" aria-hidden="true">
          S
        </span>
        <h1 className="mt-8 text-[2.5rem] font-black leading-[1.02] tracking-[-0.035em] text-balance">
          Link produk masuk,
          <br />
          naskah siap rekam keluar.
        </h1>
        <p className="mt-4 max-w-[34ch] text-ink-2">Hook yang bikin berhenti scroll, adegan per adegan, sampai teleprompter.</p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3">
        {accessDeniedEmail ? (
          <div role="alert" className="rounded-xl border border-risk/40 bg-risk/10 p-4 text-sm">
            <p className="font-bold text-risk">Akses ditolak</p>
            <p className="mt-1 text-ink-2">
              <span className="text-ink">{accessDeniedEmail}</span> bukan akun pemilik studio ini.
            </p>
            <button type="button" onClick={clearAccessDenied} className="mt-3 font-semibold text-accent underline cursor-pointer">
              Pakai akun lain
            </button>
          </div>
        ) : (
          authError && (
            <div role="alert" className="flex gap-2 rounded-xl border border-risk/40 bg-risk/10 p-3 text-sm text-risk">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {authError}
            </div>
          )
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signInWithGoogle();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Membuka Google…" : "Masuk dengan Google"}
        </Button>
      </div>
    </main>
  );
}
