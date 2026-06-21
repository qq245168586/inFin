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

  /**
   * 初始化当前服务实例和它依赖的运行时状态。
   */
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "HttpClientError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * 创建 json http client，并补齐运行时需要的默认配置。
 */
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

/**
 * 规范化 base url，避免后续业务处理不同格式的输入。
 */
function normalizeBaseUrl(value: string) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }
  return text.endsWith("/") ? text : `${text}/`;
}

/**
 * 规范化 headers，避免后续业务处理不同格式的输入。
 */
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

/**
 * 封装 request json 的业务步骤，避免调用方依赖内部实现细节。
 */
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

/**
 * 解析 json response，把字符串转换成可靠的结构化值。
 */
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

/**
 * 提取 error message，统一错误和响应字段读取方式。
 */
function extractErrorMessage(payload: any, status: number) {
  return payload?.message || payload?.error || `HTTP ${status}`;
}
