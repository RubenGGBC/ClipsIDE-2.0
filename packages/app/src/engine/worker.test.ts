/*
 * Guarda de regresión para la carga del motor.
 *
 * Hubo un fallo que ningún test cazó: el worker hacía import() de
 * /engine/clips.mjs, que vive en public/. En producción funcionaba, pero el
 * servidor de desarrollo intercepta esa petición, le añade ?import y responde
 * 500, así que la app no arrancaba al abrirla. Como ninguna prueba en DOM
 * simulado llega a instanciar el worker, el error solo aparecía en pantalla.
 *
 * Esto no sustituye a abrir el navegador, pero sí fija la decisión: el glue se
 * trae con fetch y se instancia desde un blob, nunca se importa por ruta.
 */

import { describe, expect, it } from 'vitest';
// ?raw trae el fichero como texto: así la guarda no depende de rutas del
// sistema, que bajo jsdom ni siquiera son rutas de fichero.
import source from './clips.worker.ts?raw';
import {
  createRequestProcessor,
  executeRequest,
  type Bridge,
} from './clips.worker';
import type { Request, Response, Snapshot } from './protocol';

describe('carga del motor', () => {
  it('trae el glue con fetch en vez de importarlo desde public/', () => {
    expect(source).toContain('fetch(`${ENGINE_BASE}clips.mjs`)');
  });

  it('no importa ninguna ruta de /engine directamente', () => {
    // Un import() de esa ruta es exactamente lo que rompía en desarrollo.
    expect(source).not.toMatch(/import\([^)]*['"`]\/engine\//);
  });

  it('le dice a Emscripten dónde está el .wasm', () => {
    // Desde una URL blob: no puede deducirlo, y fallaría al instanciar.
    expect(source).toContain('locateFile');
  });

  it('avisa con un mensaje legible si el motor no se puede descargar', () => {
    expect(source).toContain('No se pudo cargar el motor CLIPS');
  });
});

function bridgeWithResults(loadOk: boolean, evalCode: number, output: string): Bridge {
  return {
    init: () => true,
    output: () => output,
    outputClear: () => {},
    load: () => loadOk,
    eval: () => evalCode,
    reset: () => {},
    clear: () => {},
    run: () => 0,
    factsJson: () => '[]',
    agendaJson: () => '[]',
    templatesJson: () => '[]',
  };
}

function emptySnapshot(output: string): Snapshot {
  return {
    output,
    facts: [],
    agenda: [],
    templates: [],
    operation: { type: 'none' },
  };
}

describe('operaciones del motor', () => {
  it('devuelve un resultado de carga fallido junto con la salida capturada', async () => {
    // Given
    const bridge = bridgeWithResults(false, 0, 'ERROR de sintaxis');

    // When
    const result = await executeRequest(
      { id: 1, type: 'load', files: [{ name: 'rota.clp', text: '(defrule rota' }] },
      async () => bridge,
    );

    // Then
    expect(result.operation).toEqual({ type: 'load', ok: false });
    expect(result.output).toBe('ERROR de sintaxis');
  });

  it('devuelve un resultado de evaluación fallido sin perder la salida capturada', async () => {
    // Given
    const bridge = bridgeWithResults(true, 1, 'ERROR de evaluación');

    // When
    const result = await executeRequest(
      { id: 2, type: 'eval', command: '(función-inexistente)' },
      async () => bridge,
    );

    // Then
    expect(result.operation).toEqual({ type: 'eval', ok: false });
    expect(result.output).toBe('ERROR de evaluación');
  });

  it('procesa en FIFO aunque la primera petición siga arrancando el motor', async () => {
    // Given
    let finishBoot = () => {};
    const booting = new Promise<void>((resolve) => {
      finishBoot = resolve;
    });
    const responses: Response[] = [];
    const process = createRequestProcessor(
      async (request) => {
        if (request.id === 1) await booting;
        return emptySnapshot(String(request.id));
      },
      (response) => { responses.push(response); },
    );
    const first: Request = { id: 1, type: 'snapshot' };
    const second: Request = { id: 2, type: 'snapshot' };

    // When
    const firstDone = process(first);
    const secondDone = process(second);
    await Promise.resolve();

    // Then
    expect(responses).toEqual([]);
    finishBoot();
    await Promise.all([firstDone, secondDone]);
    expect(responses.map((response) => response.id)).toEqual([1, 2]);
    expect(responses.map((response) => response.ok ? response.snapshot.output : response.error))
      .toEqual(['1', '2']);
  });
});
