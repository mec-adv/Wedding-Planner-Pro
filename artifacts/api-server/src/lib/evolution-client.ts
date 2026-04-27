/**
 * Thin HTTP client for Evolution API v1/v2. Only handles what the WhatsApp
 * integration in this app needs: instance lifecycle + connection state.
 */

export interface EvolutionCreateInstanceInput {
  instanceName: string;
  integration: string;
  number?: string | null;
  qrcode?: boolean;
}

export interface EvolutionQrData {
  base64?: string | null;
  code?: string | null;
  pairingCode?: string | null;
}

export interface EvolutionCreateInstanceResult {
  instanceId: string | null;
  apiKey: string | null;
  qrcode: EvolutionQrData | null;
  raw: unknown;
}

export interface EvolutionConnectResult {
  qrcode: EvolutionQrData | null;
  raw: unknown;
}

export interface EvolutionConnectionStateResult {
  state: string | null;
  raw: unknown;
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${trimmed}${suffix}`;
}

async function request(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(joinUrl(baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (typeof data === "object" && data !== null && "message" in data
        ? String((data as Record<string, unknown>).message)
        : typeof data === "string"
          ? data
          : res.statusText) || "Falha na Evolution API";
    throw new Error(`Evolution API ${res.status}: ${msg}`);
  }

  return data;
}

function pickString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function extractQrcode(raw: unknown): EvolutionQrData | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  // Evolution v2 usually returns `qrcode: { base64, code, pairingCode }` at the root.
  const nested = rec.qrcode ?? rec.qr;
  if (nested && typeof nested === "object") {
    const q = nested as Record<string, unknown>;
    return {
      base64: typeof q.base64 === "string" ? q.base64 : null,
      code: typeof q.code === "string" ? q.code : null,
      pairingCode: typeof q.pairingCode === "string" ? q.pairingCode : null,
    };
  }
  // Fallback: some versions return base64 directly.
  const base64 = pickString(raw, "base64");
  const code = pickString(raw, "code");
  const pairingCode = pickString(raw, "pairingCode");
  if (base64 || code || pairingCode) {
    return { base64, code, pairingCode };
  }
  return null;
}

function extractApiKeyFromInstance(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  // Different Evolution versions:
  //  - v2 root: { instance: { ... }, hash: { apikey: '...' } }
  //  - v2 root: { hash: '...' }
  //  - v1 root: { instance: { apikey: '...' } } or { apikey: '...' }
  const direct = pickString(raw, "apikey", "apiKey");
  if (direct) return direct;

  const hash = rec.hash;
  if (typeof hash === "string" && hash.length > 0) return hash;
  if (hash && typeof hash === "object") {
    const fromHash = pickString(hash, "apikey", "apiKey");
    if (fromHash) return fromHash;
  }

  const instance = rec.instance;
  if (instance && typeof instance === "object") {
    return pickString(instance, "apikey", "apiKey");
  }
  return null;
}

function extractInstanceId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const direct = pickString(raw, "instanceId", "id");
  if (direct) return direct;
  const instance = rec.instance;
  if (instance && typeof instance === "object") {
    return pickString(instance, "instanceId", "id");
  }
  return null;
}

export async function createEvolutionInstance(
  baseUrl: string,
  adminApiKey: string,
  input: EvolutionCreateInstanceInput,
): Promise<EvolutionCreateInstanceResult> {
  const body: Record<string, unknown> = {
    instanceName: input.instanceName,
    qrcode: input.qrcode ?? true,
    integration: input.integration,
  };
  if (input.number) {
    body.number = input.number;
  }

  const raw = await request(baseUrl, adminApiKey, "/instance/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    instanceId: extractInstanceId(raw),
    apiKey: extractApiKeyFromInstance(raw),
    qrcode: extractQrcode(raw),
    raw,
  };
}

export async function connectEvolutionInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvolutionConnectResult> {
  const raw = await request(
    baseUrl,
    apiKey,
    `/instance/connect/${encodeURIComponent(instanceName)}`,
    { method: "GET" },
  );
  return { qrcode: extractQrcode(raw), raw };
}

export async function getEvolutionConnectionState(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvolutionConnectionStateResult> {
  const raw = await request(
    baseUrl,
    apiKey,
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { method: "GET" },
  );
  let state: string | null = null;
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    state = pickString(raw, "state");
    if (!state && rec.instance && typeof rec.instance === "object") {
      state = pickString(rec.instance, "state");
    }
  }
  return { state, raw };
}

export async function logoutEvolutionInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<void> {
  await request(baseUrl, apiKey, `/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  });
}

export async function deleteEvolutionInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<void> {
  await request(baseUrl, apiKey, `/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  });
}

export async function sendEvolutionText(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  text: string,
): Promise<void> {
  await request(
    baseUrl,
    apiKey,
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      body: JSON.stringify({ number, text }),
    },
  );
}
