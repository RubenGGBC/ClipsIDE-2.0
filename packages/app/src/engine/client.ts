/*
 * Cliente del motor: convierte el ir y venir de mensajes del worker en
 * promesas normales, y sabe matarlo cuando hace falta.
 */

import type { ClipsFile, Request, RequestBody, Response, Snapshot } from './protocol';

export class ClipsClientError extends Error {
  readonly name = 'ClipsClientError';
}

export class ClipsClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, {
    readonly resolve: (snapshot: Snapshot) => void;
    readonly reject: (error: Error) => void;
  }>();

  /** Se llama sola en la primera petición y después de cada stop(). */
  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./clips.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<Response>) => {
      const res = event.data;
      const slot = this.pending.get(res.id);
      if (!slot) return;
      this.pending.delete(res.id);
      if (res.ok) slot.resolve(res.snapshot);
      else slot.reject(new ClipsClientError(res.error));
    };
    worker.onerror = () => {
      this.failWorker(worker, new ClipsClientError('El worker de CLIPS ha fallado'));
    };
    worker.onmessageerror = () => {
      this.failWorker(worker, new ClipsClientError('No se pudo leer la respuesta del worker de CLIPS'));
    };

    this.worker = worker;
    return worker;
  }

  private send(req: RequestBody): Promise<Snapshot> {
    const worker = this.ensureWorker();
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: Request = { ...req, id };
      worker.postMessage(request);
    });
  }

  private failWorker(worker: Worker, error: ClipsClientError): void {
    if (this.worker !== worker) return;
    worker.terminate();
    this.worker = null;
    this.rejectPending(error);
  }

  private rejectPending(error: Error): void {
    for (const slot of this.pending.values()) {
      slot.reject(error);
    }
    this.pending.clear();
  }

  load(files: ClipsFile[]) { return this.send({ type: 'load', files }); }
  reset()                  { return this.send({ type: 'reset' }); }
  run(limit = -1)          { return this.send({ type: 'run', limit }); }
  step()                   { return this.send({ type: 'run', limit: 1 }); }
  evaluate(command: string){ return this.send({ type: 'eval', command }); }
  snapshot()               { return this.send({ type: 'snapshot' }); }

  /**
   * Corta una ejecución que no termina. No hay forma elegante de interrumpir
   * a CLIPS desde fuera —Run() no consulta ninguna bandera—, así que matamos
   * el worker. El precio es perder el entorno: quien llame debe volver a
   * cargar los ficheros. A cambio, un bucle infinito deja de ser fatal.
   */
  stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.rejectPending(new ClipsClientError('Ejecución detenida'));
  }
}
