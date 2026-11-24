import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Download, Flame, History, LogOut, PenLine, SlidersHorizontal, WifiOff } from "lucide-react";
import { useStudio } from "../../contexts/StudioContext";
import { useOnlineStatus, usePWAInstall } from "../../lib/use-pwa";
import { cn } from "../../lib/utils";

const NAV = [
  { to: "/studio", label: "Buat", icon: PenLine },
  { to: "/trends", label: "Ide", icon: Flame },
  { to: "/history", label: "Riwayat", icon: History },
  { to: "/brand", label: "Gaya", icon: SlidersHorizontal },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { brand, owner, logout } = useStudio();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const initial = (brand?.accountName ?? "S").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <button type="button" onClick={() => navigate("/studio")} className="flex min-h-[44px] items-center gap-2.5 cursor-pointer">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-black text-on-accent" aria-hidden="true">
              S
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.02em]">Script Studio</span>
          </button>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-raised text-ink" : "text-ink-2 hover:text-ink",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Menu akun"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full cursor-pointer"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line-strong bg-raised text-sm font-bold">{initial}</span>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.5)]">
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-bold">{brand?.accountName}</p>
                  <p className="truncate text-xs text-ink-3">{owner?.email}</p>
                </div>
                {!isInstalled && isInstallable && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void install();
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-raised cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-accent" aria-hidden="true" />
                    Pasang di layar utama
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-risk hover:bg-raised cursor-pointer"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!isOnline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Offline. Naskah baru butuh koneksi.
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">{children}</main>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                  isActive ? "text-accent" : "text-ink-3 hover:text-ink",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
