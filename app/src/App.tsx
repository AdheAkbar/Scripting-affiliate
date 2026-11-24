import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { StudioProvider, useStudio } from "./contexts/StudioContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AppShell } from "./components/layout/AppShell";
import { BrandPage } from "./pages/BrandPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PrompterPage } from "./pages/PrompterPage";
import { ScriptDetailPage } from "./pages/ScriptDetailPage";
import { StudioPage } from "./pages/StudioPage";
import { TrendsPage } from "./pages/TrendsPage";

/** Share target Android (/studio/new?url=…) diteruskan ke Studio dengan parameter yang sama. */
function ShareRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/studio${search}`} replace />;
}

function AuthenticatedRoutes() {
  const { isLoadingAuth, owner } = useStudio();
  if (isLoadingAuth) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <span className="grid h-10 w-10 animate-pulse place-items-center rounded-lg bg-accent text-lg font-black text-on-accent" aria-label="Memuat">
          S
        </span>
      </div>
    );
  }
  if (!owner) return <LoginScreen />;
  return (
    <Routes>
      <Route path="/prompter/:id" element={<PrompterPage />} />
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/studio" replace />} />
              <Route path="/studio" element={<StudioPage />} />
              <Route path="/studio/new" element={<ShareRedirect />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<ScriptDetailPage />} />
              <Route path="/brand" element={<BrandPage />} />
              <Route path="*" element={<Navigate to="/studio" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StudioProvider>
          <AuthenticatedRoutes />
        </StudioProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
