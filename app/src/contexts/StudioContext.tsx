import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import type { BrandInput } from "../../shared/schemas";
import { api, ApiError, type BrandDoc, type OwnerInfo } from "../lib/api";
import { auth, googleProvider } from "../lib/firebase";
import { createSeedBrand, fetchAppConfig, fetchOwnerBrands, updateOwnerBrand, upsertAppConfig, type BrandEditablePayload } from "../lib/firestore-studio";
import { listScripts, type ScriptDoc } from "../lib/scripts-store";

interface StudioContextValue {
  isLoadingAuth: boolean;
  owner: OwnerInfo | null;
  brand: BrandDoc | null;
  brandInput: BrandInput | null;
  bannedPhrasesPreset: string[];
  scripts: ScriptDoc[];
  refreshScripts: () => Promise<void>;
  accessDeniedEmail: string | null;
  authError: string | null;
  clearAccessDenied: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveBrand: (payload: BrandEditablePayload) => Promise<BrandDoc>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

function toBrandInput(b: BrandDoc): BrandInput {
  const { id: _id, ownerUid: _o, createdAt: _c, updatedAt: _u, cachedSystemBlock: _b, cachedSystemBlockTokens: _t, ...rest } = b;
  return rest;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [brand, setBrand] = useState<BrandDoc | null>(null);
  const [scripts, setScripts] = useState<ScriptDoc[]>([]);
  const [bannedPhrasesPreset, setBannedPhrasesPreset] = useState<string[]>([]);
  const [accessDeniedEmail, setAccessDeniedEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setOwner(null);
    setBrand(null);
    setScripts([]);
  }, []);

  const hydrate = useCallback(
    async (user: User) => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const me = await api.getMe(await user.getIdToken());
        setOwner(me.owner);
        setBannedPhrasesPreset(me.preset.brand.bannedPhrases);

        const brands = await fetchOwnerBrands(me.owner.uid);
        const active = brands[0] ?? (await createSeedBrand(me.owner.uid, me.preset.brand));
        setBrand(active);

        const config = await fetchAppConfig();
        if (!config?.activeBrandId) {
          await upsertAppConfig({ ownerEmail: me.owner.email, monthlyBudgetUsd: config?.monthlyBudgetUsd ?? 10, activeBrandId: active.id });
        }
        setScripts(await listScripts(me.owner.uid).catch(() => []));
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.code === "ACCESS_DENIED")) {
          clear();
          setAccessDeniedEmail(user.email ?? "akun ini");
          await signOut(auth).catch(() => undefined);
          return;
        }
        clear();
        setAuthError(err instanceof Error ? err.message : "Gagal memuat data. Coba masuk ulang.");
      } finally {
        setIsLoadingAuth(false);
      }
    },
    [clear],
  );

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          clear();
          setIsLoadingAuth(false);
          return;
        }
        void hydrate(user);
      }),
    [clear, hydrate],
  );

  const refreshScripts = useCallback(async () => {
    if (owner) setScripts(await listScripts(owner.uid));
  }, [owner]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAccessDeniedEmail(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      setAuthError(
        code === "auth/popup-blocked"
          ? "Popup Google diblokir browser. Izinkan popup untuk situs ini lalu coba lagi."
          : code === "auth/unauthorized-domain"
            ? "Domain ini belum diizinkan di Firebase Auth. Buka lewat http://localhost:3000."
            : "Gagal membuka login Google. Periksa koneksi lalu coba lagi.",
      );
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    clear();
  }, [clear]);

  const saveBrand = useCallback(
    async (payload: BrandEditablePayload) => {
      if (!owner || !brand) throw new Error("Sesi tidak aktif. Masuk ulang.");
      const saved = await updateOwnerBrand(brand.id, owner.uid, payload, brand.createdAt);
      setBrand(saved);
      return saved;
    },
    [owner, brand],
  );

  const brandInput = useMemo(() => (brand ? toBrandInput(brand) : null), [brand]);

  return (
    <StudioContext.Provider
      value={{
        isLoadingAuth,
        owner,
        brand,
        brandInput,
        bannedPhrasesPreset,
        scripts,
        refreshScripts,
        accessDeniedEmail,
        authError,
        clearAccessDenied: () => setAccessDeniedEmail(null),
        signInWithGoogle,
        logout,
        saveBrand,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio harus dipanggil di dalam StudioProvider");
  return ctx;
}
