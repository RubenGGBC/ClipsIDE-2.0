/*
 * Cliente del motor: convierte el ir y venir de mensajes del worker en
 * promesas normales, y sabe matarlo cuando hace falta.
 */

import type { ClipsFile, Request, RequestBody, Response, Snapshot } from './protocol';

export class ClipsClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (s: Snapshot) => void; reject: (e: Error) => void }>();

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
      else slot.reject(new Error(res.error));
    };

    this.worker = worker;
    return worker;
  }

  private send(req: RequestBody): Promise<Snapshot> {
    const worker = this.ensureWorker();
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...req, id } as Request);
    });
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
    for (const [, slot] of this.pending) {
      slot.reject(new Error('Ejecución detenida'));
    }
    this.pending.clear();
  }
}
