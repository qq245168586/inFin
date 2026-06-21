export type JsonHttpClientOptions = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type JsonRequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class HttpClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "HttpClientError";
    this.status = status;
    this.payload = payload;
  }
}

export function createJsonHttpClient(options: JsonHttpClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const defaultHeaders = normalizeHeaders(options.defaultHeaders);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!baseUrl || typeof fetchImpl !== "function") {
    return null;
  }

  return {
    post: (pathname: string, body: unknown, requestOptions: JsonRequestOptions = {}) =>
      requestJson(fetchImpl, baseUrl, pathname, {
        method: "POST",
        headers: {
          ...defaultHeaders,
          ...normalizeHeaders(requestOptions.headers)
        },
        body: JSON.stringify(body),
        timeoutMs: Number(requestOptions.timeoutMs) > 0 ? Number(requestOptions.timeoutMs) : timeoutMs
      })
  };
}

function normalizeBaseUrl(value: string) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.endsWith("/") ? text : `${text}/`;
}

function normalizeHeaders(headers: Record<string, string> = {}) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = String(key || "").trim().toLowerCase();
    if (!name) {
      continue;
    }
    normalized[name] = String(value);
  }
  return normalized;
}

async function requestJson(
  fetchImpl: typeof fetch,
  baseUrl: string,
  pathname: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
  }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchImpl(new URL(pathname, baseUrl), {
      method: options.method,
      headers: {
        "content-type": "application/json",
        ...options.headers
      },
      body: options.body,
      signal: controller.signal
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      const message = extractErrorMessage(payload, response.status);
      throw new HttpClientError(message, response.status, payload);
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractErrorMessage(payload: any, status: number) {
  return payload?.message || payload?.error || `HTTP ${status}`;
}
