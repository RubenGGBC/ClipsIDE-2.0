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
