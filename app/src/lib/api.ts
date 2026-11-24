import type { z } from "zod";
import type { AppConfig, Brand } from "../../shared/schemas";

export interface OwnerInfo {
  uid: string;
  email: string;
}

export interface BrandDoc extends Brand {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfigDoc extends z.infer<typeof AppConfig> {
  updatedAt: string;
}

export interface BrandPresetPayload {
  appConfig: {
    ownerEmail: string;
    monthlyBudgetUsd: number;
  };
  brand: Omit<Brand, "ownerUid" | "cachedSystemBlock" | "cachedSystemBlockTokens">;
}

export interface MeResponse {
  owner: OwnerInfo;
  monthKey: string;
  preset: BrandPresetPayload;
}

export interface SystemPromptPreviewResponse {
  cachedSystemBlock: string;
  cachedSystemBlockTokens: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: Array<{ path: (string | number)[]; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    issues?: Array<{ path: (string | number)[]; message: string }>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
    issues?: Array<{ path: (string | number)[]; message: string }>;
  };

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.code ?? "REQUEST_FAILED",
      data.error ?? `HTTP ${res.status}`,
      data.issues,
    );
  }
  return data as T;
}

export const api = {
  getMe: (idToken: string) => request<MeResponse>("/api/me", { token: idToken }),
  previewSystemPrompt: (
    idToken: string,
    payload: Omit<Brand, "ownerUid" | "cachedSystemBlock" | "cachedSystemBlockTokens">,
  ) =>
    request<SystemPromptPreviewResponse>("/api/brand/system-prompt", {
      method: "POST",
      token: idToken,
      body: payload,
    }),
};
