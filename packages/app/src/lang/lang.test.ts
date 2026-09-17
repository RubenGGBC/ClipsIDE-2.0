/*
 * El índice y el autocompletado son la pieza que más fácil se rompe: tienen
 * que funcionar sobre código a medio escribir, que es justo cuando el usuario
 * pide ayuda. Estos tests describen ese caso, no el caso bonito.
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { buildIndex, parseForms, ruleAt } from './symbols';
import { clipsCompletions } from './clips';

const PROGRAMA = `
(deftemplate persona
   (slot nombre)
   (multislot apodos))

(defrule saludar
   (persona (nombre ?n) (apodos $?a))
   =>
   (printout t ?n crlf))

(deffunction doble (?x)
   (* 2 ?x))

(defglobal ?*limite* = 10)
`;

const files = [{ name: 'test.clp', text: PROGRAMA }];

describe('parseForms', () => {
  it('separa las formas de nivel superior', () => {
    const heads = parseForms(PROGRAMA).map((f) => f.head);
    expect(heads).toEqual(['deftemplate', 'defrule', 'deffunction', 'defglobal']);
  });

  it('no se traga los paréntesis que van dentro de cadenas', () => {
    const forms = parseForms('(printout t "no cierres )( esto" crlf)');
    expect(forms).toHaveLength(1);
  });

  it('ignora los paréntesis comentados', () => {
    const forms = parseForms('(defrule r ; un ) despistado\n => )');
    expect(forms).toHaveLength(1);
  });

  it('devuelve la forma aunque esté sin cerrar', () => {
    // El caso normal mientras escribes.
    const forms = parseForms('(deftemplate persona (slot nombre)');
    expect(forms).toHaveLength(1);
    expect(forms[0].name).toBe('persona');
  });
});

describe('buildIndex', () => {
  const index = buildIndex(files);

  it('recoge los slots distinguiendo multislot', () => {
    const persona = index.templates.get('persona')!;
    expect(persona.slots).toEqual([
      { name: 'nombre', multi: false },
      { name: 'apodos', multi: true },
    ]);
  });

  it('apunta la línea de cada definición para poder saltar a ella', () => {
    expect(index.rules.get('saludar')!.line).toBe(6);
  });

  it('recoge los parámetros de las funciones', () => {
    expect(index.functions.get('doble')!.params).toEqual(['x']);
  });

  it('recoge las variables globales', () => {
    expect([...index.globals]).toEqual(['limite']);
  });
});

describe('ruleAt', () => {
  it('encuentra las variables ligadas antes del cursor', () => {
    const pos = PROGRAMA.indexOf('=>');
    expect(ruleAt(PROGRAMA, pos)!.variables).toEqual(['n', 'a']);
  });

  it('devuelve null fuera de toda regla', () => {
    expect(ruleAt(PROGRAMA, 5)).toBeNull();
  });
});

/** Coloca el cursor donde está el marcador | y pide sugerencias. */
function completar(texto: string) {
  const pos = texto.indexOf('|');
  const doc = texto.replace('|', '');
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, pos, true);
  const source = clipsCompletions(() => buildIndex([{ name: 'a.clp', text: doc }]));
  return source(context);
}

describe('autocompletado', () => {
  it('dentro de un patrón ofrece los slots de ESE template', () => {
    const result = completar(`${PROGRAMA}\n(defrule otra (persona (|`);
    const etiquetas = result!.options.map((o) => o.label);
    expect(etiquetas).toContain('nombre');
    expect(etiquetas).toContain('apodos');
  });

  it('marca cuál de los slots es multislot', () => {
    const result = completar(`${PROGRAMA}\n(defrule otra (persona (|`);
    const apodos = result!.options.find((o) => o.label === 'apodos')!;
    expect(apodos.detail).toContain('multislot');
  });

  it('al escribir ? ofrece las variables de esta regla', () => {
    const result = completar(`${PROGRAMA}\n(defrule otra (persona (nombre ?quien)) => (printout t ?|`);
    const etiquetas = result!.options.map((o) => o.label);
    expect(etiquetas).toContain('?quien');
  });

  it('no ofrece variables de otras reglas', () => {
    const result = completar(`${PROGRAMA}\n(defrule otra (persona (nombre ?quien)) => (printout t ?|`);
    const etiquetas = result!.options.map((o) => o.label);
    expect(etiquetas).not.toContain('?n');
  });

  it('ofrece las globales estés donde estés', () => {
    const result = completar(`${PROGRAMA}\n(defrule otra (persona (nombre ?quien)) => (printout t ?|`);
    expect(result!.options.map((o) => o.label)).toContain('?*limite*');
  });

  it('en nivel superior solo propone construcciones', () => {
    const result = completar(`${PROGRAMA}\n(|`);
    const etiquetas = result!.options.map((o) => o.label);
    expect(etiquetas).toContain('defrule');
    expect(etiquetas).not.toContain('printout');
  });
});
