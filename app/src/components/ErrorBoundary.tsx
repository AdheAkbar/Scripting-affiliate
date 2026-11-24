import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Terjadi kesalahan tak terduga pada aplikasi.",
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ErrorBoundary caught error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      let friendlyText =
        "Terjadi kendala saat mengakses data Firestore atau merender layar. Silakan muat ulang.";
      if (this.state.message.includes("Missing or insufficient permissions")) {
        friendlyText =
          "Akses ke dokumen Firestore ditolak oleh aturan keamanan. Pastikan akun Google Anda terdaftar sebagai owner.";
      }

      return (
        <main className="min-h-dvh bg-canvas flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-risk/40 bg-surface">
            <CardHeader>
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-risk/15 text-risk">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-ink">Terjadi Kendala</CardTitle>
              <CardDescription className="text-ink-2">{friendlyText}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Muat Ulang Aplikasi
              </Button>
            </CardContent>
          </Card>
        </main>
      );
    }

    return this.props.children;
  }
}
