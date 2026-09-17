/*
 * La paleta es un contrato, no una sugerencia.
 *
 * El contrato son cinco colores base, un puñado de acentos elegidos a mano y
 * los tintes mezclados con ellos. Nada más. Este test no juzga si un color es
 * bonito: obliga a que entre por la lista, para que ningún color aparezca en
 * la hoja de estilos sin que alguien lo haya decidido.
 */

import { describe, expect, it } from 'vitest';
import css from './index.css?inline';

/** Los cinco colores base que fijó el usuario. */
const PALETA = ['0d1b2a', '1b263b', '415a77', '778da9', 'e0e1dd'];

/**
 * Acentos fuera de los cinco base. Existen porque la paleta es toda fría y
 * sin ellos el ciclo de inferencia (qué espera, qué nace, qué se retracta)
 * no se distingue de un vistazo.
 */
const ACENTOS = [
  'c9a227', 'd8b640', // ámbar: acción principal y trabajo pendiente
  '7fb2a6',           // verde: confirmación y hechos nuevos
  'c4787e',           // terracota: retracción y error
  '9a8fc8',           // violeta: construcciones de CLIPS
  '9fb68b', 'c6a27d', // literales y números en el editor
];

/**
 * Tintes mezclados a partir de la paleta. Añadir uno aquí es una decisión
 * consciente; que aparezca sin pasar por esta lista, no.
 */
const TINTES = [
  '22334a', '293c55', '2a3b52', '172033', '15253a', '112033', '111f31',
  '304762', '8795aa', '9db0c4', 'b6c4d2', '8fa3b8', 'c3cbd3', 'c2cbd4',
  '5a7391', 'f1f2ef',
];

const PERMITIDOS = new Set([...PALETA, ...ACENTOS, ...TINTES]);

/** Canales rgb() permitidos, en el mismo espíritu. */
const RGB_PERMITIDOS = new Set([
  '201 162 39',  // c9a227
  '127 178 166', // 7fb2a6
  '196 120 126', // c4787e
  '65 90 119',   // 415a77
  '13 27 42',    // 0d1b2a
  '42 59 82',    // 2a3b52
  '5 12 22',     // sombra, más oscura que el fondo
]);

describe('paleta', () => {
  it('no usa ningún color que no esté declarado', () => {
    const encontrados = [...css.matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
    const intrusos = [...new Set(encontrados)].filter((hex) => !PERMITIDOS.has(hex));
    expect(intrusos).toEqual([]);
  });

  it('tampoco por la puerta de atrás de rgb()', () => {
    const encontrados = [...css.matchAll(/rgb\(([0-9]+ [0-9]+ [0-9]+)\s*\//g)].map((m) => m[1]);
    const intrusos = [...new Set(encontrados)].filter((rgb) => !RGB_PERMITIDOS.has(rgb));
    expect(intrusos).toEqual([]);
  });

  it('define los cinco colores de la paleta', () => {
    for (const color of PALETA) {
      expect(css.toLowerCase()).toContain(`#${color}`);
    }
  });
});
