import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiRouter } from "./server/index";

const PORT = Number(process.env.PORT ?? 3000);
const isBundledServer =
  import.meta.url.endsWith("/server.mjs") ||
  (process.argv[1]?.endsWith("server.mjs") ?? false);
const isProduction = process.env.NODE_ENV === "production" || isBundledServer;

function resolveDistDir(): string {
  const fromCwd = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(path.join(fromCwd, "index.html"))) {
    return fromCwd;
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // API routes (semua route selain /api/health dilindungi verifikasi Firebase ID token + OWNER_EMAIL)
  app.use("/api", createApiRouter());

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = resolveDistDir();
    // Jangan pernah melayani bundle server.mjs sebagai file statis publik
    app.use((req, res, next) => {
      if (req.path === "/server.mjs" || req.path.endsWith("/server.mjs")) {
        res.status(404).send("Not Found");
        return;
      }
      next();
    });
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ code: "NOT_FOUND", error: "Endpoint API tidak ditemukan." });
        return;
      }
      const indexHtml = path.resolve(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build tidak ditemukan.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Affiliate Script Studio berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal menjalankan server:", err);
  process.exit(1);
});
