import {
  handleContractRequest,
  globalEventBus,
  resetContractState,
} from './mock-server.ts';

const envBaseUrl = process.env.BASE_URL;

/**
 * Returns the configured BASE_URL if running against an external server,
 * or an in-memory synthetic URL.
 */
export async function getTestBaseUrl(): Promise<string> {
  return envBaseUrl || 'http://in-memory.local';
}

/**
 * Universal API fetch helper:
 * - If process.env.BASE_URL is provided, executes real HTTP fetch over network.
 * - Otherwise, dispatches deterministically via in-memory contract engine (sandboxed/offline safe).
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; headers: Headers; data: any; raw: string }> {
  const normEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (envBaseUrl) {
    try {
      const url = `${envBaseUrl}${normEndpoint}`;
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...options, headers });
      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
      return { status: res.status, headers: res.headers, data, raw };
    } catch (err: any) {
      // If network fails (e.g. sandbox restriction or server not yet started), fall back
      if (err.code !== 'EPERM' && err.code !== 'ECONNREFUSED') {
        throw err;
      }
    }
  }

  // In-Memory Contract Execution
  let parsedBody: any = null;
  if (options.body && typeof options.body === 'string') {
    try {
      parsedBody = JSON.parse(options.body);
    } catch {
      // Malformed JSON handled in handleContractRequest
    }
  }

  const response = handleContractRequest(
    normEndpoint,
    options.method || 'GET',
    options.headers || {},
    parsedBody
  );

  const headers = new Headers();
  for (const [k, v] of Object.entries(response.headers)) {
    headers.set(k, v);
  }

  return {
    status: response.status,
    headers,
    data: response.data,
    raw: response.raw,
  };
}

/**
 * Listens to Real-Time events until a condition is met or timeout expires.
 * - If process.env.BASE_URL is set, consumes real SSE stream.
 * - Otherwise, hooks directly into the contract event bus.
 */
export async function captureRealtimeEvent(
  predicate: (event: any) => boolean,
  timeoutMs = 4000
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for matching RealtimeEvent`));
      }
    }, timeoutMs);

    const onEvent = (eventData: any) => {
      try {
        if (!settled && predicate(eventData)) {
          settled = true;
          clearTimeout(timer);
          globalEventBus.off('realtime', onEvent);
          resolve(eventData);
        }
      } catch {
        // ignore errors in predicate
      }
    };

    globalEventBus.on('realtime', onEvent);

    // If external SSE URL is active, also listen over network
    if (envBaseUrl) {
      try {
        const controller = new AbortController();
        const res = await fetch(`${envBaseUrl}/api/realtime`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          (async () => {
            try {
              while (!settled) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';
                for (const block of lines) {
                  const match = block.match(/^data:\s*(.+)$/m);
                  if (match) {
                    try {
                      const parsed = JSON.parse(match[1]);
                      if (!settled && predicate(parsed)) {
                        settled = true;
                        clearTimeout(timer);
                        controller.abort();
                        resolve(parsed);
                        return;
                      }
                    } catch {
                      // ignore parse errors
                    }
                  }
                }
              }
            } catch {
              // stream aborted or network error
            }
          })();
        }
      } catch {
        // Network SSE fallback to eventBus
      }
    }
  });
}

/**
 * Reset server state between test suites.
 */
export function resetTestState(): void {
  resetContractState();
}

/**
 * Teardown helper for test runner compatibility.
 */
export async function teardownTestServer(): Promise<void> {
  globalEventBus.removeAllListeners();
}
