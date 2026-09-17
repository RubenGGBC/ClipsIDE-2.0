import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipsClient } from './client';
import type { Request, Response, Snapshot } from './protocol';

const EMPTY_SNAPSHOT: Snapshot = {
  output: '',
  facts: [],
  agenda: [],
  templates: [],
  operation: { type: 'none' },
};

class TestWorker {
  onmessage: ((event: MessageEvent<Response>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly requests: Request[] = [];
  terminated = false;

  postMessage(request: Request): void {
    this.requests.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(response: Response): void {
    this.onmessage?.(new MessageEvent<Response>('message', { data: response }));
  }

  emitError(): void {
    this.onerror?.(new ErrorEvent('error'));
  }

  emitMessageError(): void {
    this.onmessageerror?.(new MessageEvent('messageerror'));
  }
}

const workers: TestWorker[] = [];

class InstalledTestWorker extends TestWorker {
  constructor() {
    super();
    workers.push(this);
  }
}

function workerAt(index: number): TestWorker {
  const worker = workers[index];
  if (!worker) throw new RangeError(`No existe el worker de prueba ${index}`);
  return worker;
}

function resolveFirstRequest(worker: TestWorker): void {
  const request = worker.requests[0];
  if (!request) throw new RangeError('El worker no ha recibido ninguna petición');
  worker.emitMessage({ id: request.id, ok: true, snapshot: EMPTY_SNAPSHOT });
}

beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal('Worker', InstalledTestWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClipsClient', () => {
  it('rechaza todas las peticiones y crea otro worker después de error', async () => {
    // Given
    const client = new ClipsClient();
    const first = client.snapshot();
    const second = client.run();
    const worker = workerAt(0);

    // When
    expect(worker.onerror).toBeTypeOf('function');
    if (!worker.onerror) return;
    worker.emitError();
    const outcomes = await Promise.allSettled([first, second]);

    // Then
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected');
      if (outcome.status === 'rejected') {
        const reason: unknown = outcome.reason;
        expect(reason).toBeInstanceOf(Error);
      }
    }
    expect(worker.terminated).toBe(true);

    const recovered = client.snapshot();
    expect(workers).toHaveLength(2);
    resolveFirstRequest(workerAt(1));
    await expect(recovered).resolves.toEqual(EMPTY_SNAPSHOT);
  });

  it('rechaza todas las peticiones y crea otro worker después de messageerror', async () => {
    // Given
    const client = new ClipsClient();
    const first = client.load([]);
    const second = client.snapshot();
    const worker = workerAt(0);

    // When
    expect(worker.onmessageerror).toBeTypeOf('function');
    if (!worker.onmessageerror) return;
    worker.emitMessageError();
    const outcomes = await Promise.allSettled([first, second]);

    // Then
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected']);
    expect(worker.terminated).toBe(true);

    const recovered = client.snapshot();
    expect(workers).toHaveLength(2);
    resolveFirstRequest(workerAt(1));
    await expect(recovered).resolves.toEqual(EMPTY_SNAPSHOT);
  });
});
