// ============================================================
// A tiny in-process HTTP supplier used by the integration tests.
// It implements the CustomSupplierProvider contract and can be told
// to return SUCCESS / PENDING / FAILED / timeout so the order engine's
// branching can be exercised deterministically.
// ============================================================
import { createServer, type Server } from 'node:http';

export type MockMode = 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN';

export interface MockSupplier {
  server: Server;
  url: string;
  setMode(mode: MockMode): void;
  calls: { order: number; status: number };
  lastOrderBody: Record<string, unknown> | null;
  close(): Promise<void>;
}

export async function startMockSupplier(port = 4010): Promise<MockSupplier> {
  let mode: MockMode = 'SUCCESS';
  const calls = { order: 0, status: 0 };
  let lastOrderBody: Record<string, unknown> | null = null;

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      const send = (obj: unknown, code = 200) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };

      if (req.url?.endsWith('/order')) {
        calls.order += 1;
        lastOrderBody = parsed;
        if (mode === 'UNKNOWN') {
          // Simulate a dropped connection / gateway timeout: the client
          // sees a network error (status 0) and MUST treat the outcome as
          // ambiguous (never blindly retry).
          res.destroy();
          return;
        }
        send({
          status: mode,
          trxId: `MOCK-${parsed.refId ?? 'x'}`,
          code: mode === 'FAILED' ? 'E01' : '00',
          message: `mock ${mode}`,
        });
        return;
      }

      if (req.url?.endsWith('/status')) {
        calls.status += 1;
        send({ status: mode, trxId: `MOCK-${parsed.refId ?? 'x'}`, code: '00', message: `mock ${mode}` });
        return;
      }

      if (req.url?.endsWith('/balance')) {
        send({ status: 'SUCCESS', balance: 1_000_000, message: 'OK' });
        return;
      }

      send({ status: 'FAILED', message: 'not found' }, 404);
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  return {
    server,
    url: `http://127.0.0.1:${port}`,
    setMode: (m) => {
      mode = m;
    },
    calls,
    get lastOrderBody() {
      return lastOrderBody;
    },
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
