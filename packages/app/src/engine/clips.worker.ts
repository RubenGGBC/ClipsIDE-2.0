/*
 * El motor CLIPS, aislado en un Web Worker.
 *
 * Vive aquí y no en el hilo principal por una razón concreta: Run() es
 * bloqueante, así que una regla con bucle infinito —el clásico error de
 * primera práctica— congelaría la pestaña entera. Aquí, el botón Stop
 * simplemente termina el worker y la interfaz ni se entera.
 */

import type { Request, Response, Snapshot } from './protocol';

interface EmscriptenModule {
  cwrap: (name: string, ret: string | null, args: string[]) => (...a: unknown[]) => never;
}

/** Opciones que Emscripten acepta al crear el módulo. */
interface ModuleOptions {
  locateFile: (path: string) => string;
}

/** Dónde se sirven clips.mjs y clips.wasm. */
const ENGINE_BASE = '/engine/';

type Bridge = {
  init: () => boolean;
  output: () => string;
  outputClear: () => void;
  load: (text: string) => boolean;
  eval: (command: string) => number;
  reset: () => void;
  clear: () => void;
  run: (limit: number) => number;
  factsJson: () => string;
  agendaJson: () => string;
  templatesJson: () => string;
};

let bridge: Bridge | null = null;

async function boot(): Promise<Bridge> {
  if (bridge) return bridge;

  // No se puede hacer import() de un fichero de /public: en desarrollo Vite
  // intercepta la petición, le añade ?import y responde 500 ("this file is in
  // /public"). Así que traemos el glue como texto y lo convertimos en módulo
  // nosotros, lo que se comporta igual en desarrollo y en producción.
  const response = await fetch(`${ENGINE_BASE}clips.mjs`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el motor CLIPS (${response.status} en ${ENGINE_BASE}clips.mjs)`);
  }

  const blobUrl = URL.createObjectURL(
    new Blob([await response.text()], { type: 'text/javascript' }),
  );

  let createModule: (options: ModuleOptions) => Promise<EmscriptenModule>;
  try {
    createModule = (await import(/* @vite-ignore */ blobUrl)).default;
  } finally {
    // El módulo ya está cargado; el blob solo haría crecer la memoria.
    URL.revokeObjectURL(blobUrl);
  }

  // Desde una URL blob: Emscripten no puede deducir dónde está el .wasm,
  // así que se lo decimos.
  const mod: EmscriptenModule = await createModule({
    locateFile: (path: string) => `${ENGINE_BASE}${path}`,
  });

  const w = mod.cwrap.bind(mod) as EmscriptenModule['cwrap'];
  bridge = {
    init: w('cw_init', 'boolean', []) as unknown as () => boolean,
    output: w('cw_output', 'string', []) as unknown as () => string,
    outputClear: w('cw_output_clear', null, []) as unknown as () => void,
    load: w('cw_load', 'boolean', ['string']) as unknown as (t: string) => boolean,
    eval: w('cw_eval', 'number', ['string']) as unknown as (c: string) => number,
    reset: w('cw_reset', null, []) as unknown as () => void,
    clear: w('cw_clear', null, []) as unknown as () => void,
    run: w('cw_run', 'number', ['number']) as unknown as (l: number) => number,
    factsJson: w('cw_facts_json', 'string', []) as unknown as () => string,
    agendaJson: w('cw_agenda_json', 'string', []) as unknown as () => string,
    templatesJson: w('cw_templates_json', 'string', []) as unknown as () => string,
  };

  bridge.init();
  return bridge;
}

function snapshot(b: Bridge, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    output: b.output(),
    facts: JSON.parse(b.factsJson()),
    agenda: JSON.parse(b.agendaJson()),
    templates: JSON.parse(b.templatesJson()),
    ...extra,
  };
}

async function handle(req: Request): Promise<Snapshot> {
  const b = await boot();

  switch (req.type) {
    case 'load': {
      // El ciclo que en el IDE oficial hay que teclear a mano cada vez.
      b.outputClear();
      b.clear();
      let loadOk = true;
      for (const file of req.files) {
        if (!b.load(file.text)) loadOk = false;
      }
      b.reset();
      return snapshot(b, { loadOk });
    }

    case 'reset': {
      b.outputClear();
      b.reset();
      return snapshot(b);
    }

    case 'run': {
      b.outputClear();
      const fired = b.run(req.limit);
      return snapshot(b, { fired });
    }

    case 'eval': {
      b.outputClear();
      b.eval(req.command);
      return snapshot(b);
    }

    case 'snapshot':
      return snapshot(b);
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data;
  try {
    const result: Response = { id: req.id, ok: true, snapshot: await handle(req) };
    self.postMessage(result);
  } catch (err) {
    const result: Response = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(result);
  }
};
