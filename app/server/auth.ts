import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export interface OwnerPrincipal {
  uid: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      owner?: OwnerPrincipal;
      idToken?: string;
    }
  }
}

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

interface BrandPresetConfig {
  appConfig?: {
    ownerEmail?: string;
    monthlyBudgetUsd?: number;
  };
}

let cachedProjectId: string | null = null;
let cachedOwnerEmail: string | null = null;

function readFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  const fromEnv = process.env.FIREBASE_PROJECT_ID?.trim();
  if (fromEnv) {
    cachedProjectId = fromEnv;
    return fromEnv;
  }
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as FirebaseAppletConfig;
  if (!raw.projectId || raw.projectId === "remixed-project-id") {
    throw new Error("firebase-applet-config.json belum memiliki projectId yang valid.");
  }
  cachedProjectId = raw.projectId;
  return raw.projectId;
}

export function getOwnerEmail(): string {
  if (cachedOwnerEmail) return cachedOwnerEmail;
  const fromEnv = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (fromEnv) {
    cachedOwnerEmail = fromEnv;
    return fromEnv;
  }
  const presetPath = path.resolve(process.cwd(), "seed", "brand-preset.json");
  const preset = JSON.parse(fs.readFileSync(presetPath, "utf-8")) as BrandPresetConfig;
  const fallback = preset.appConfig?.ownerEmail?.trim().toLowerCase();
  if (!fallback) {
    throw new Error("OWNER_EMAIL belum dikonfigurasi.");
  }
  cachedOwnerEmail = fallback;
  return fallback;
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    projectId: readFirebaseProjectId(),
  });
}

/**
 * Memverifikasi Firebase ID token (tanpa checkRevoked agar bekerja di semua tipe project
 * tanpa IAM tambahan) + memverifikasi allowlist email owner dan status email_verified.
 */
export async function requireOwnerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      error: "Token autentikasi tidak ditemukan. Silakan masuk dengan Google.",
    });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      error: "Token autentikasi kosong. Silakan masuk dengan Google.",
    });
    return;
  }

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    const allowedEmail = getOwnerEmail();

    if (!email || decoded.email_verified !== true || email !== allowedEmail) {
      res.status(403).json({
        code: "ACCESS_DENIED",
        error: "Akses ditolak. Akun Google ini bukan owner aplikasi.",
      });
      return;
    }

    req.owner = {
      uid: decoded.uid,
      email,
    };
    req.idToken = idToken;
    next();
  } catch {
    res.status(401).json({
      code: "INVALID_TOKEN",
      error: "Sesi Google tidak valid atau kedaluwarsa. Silakan masuk ulang.",
    });
  }
}
