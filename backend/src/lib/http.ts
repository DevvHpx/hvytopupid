// ============================================================
// Minimal HTTP client wrapper around the global fetch.
//  - hard timeout via AbortController
//  - never logs secrets (caller passes sanitised bodies)
//  - returns a normalised shape so providers share error handling
// ============================================================

export interface HttpResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
  error?: string;
}

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  /** JSON or form-urlencoded */
  contentType?: 'json' | 'form';
  timeoutMs?: number;
}

export async function httpRequest<T = unknown>(url: string, opts: HttpOptions = {}): Promise<HttpResult<T>> {
  const { method = 'POST', headers = {}, body, contentType = 'json', timeoutMs = 15000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let payload: string | undefined;
  const finalHeaders: Record<string, string> = { accept: 'application/json', ...headers };

  if (body !== undefined) {
    if (contentType === 'form') {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v !== undefined && v !== null) params.append(k, String(v));
      }
      payload = params.toString();
      finalHeaders['content-type'] = 'application/x-www-form-urlencoded';
    } else {
      payload = JSON.stringify(body);
      finalHeaders['content-type'] = 'application/json';
    }
  }

  try {
    const res = await fetch(url, { method, headers: finalHeaders, body: payload, signal: controller.signal });
    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      text: '',
      error: aborted ? `timeout after ${timeoutMs}ms` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}
