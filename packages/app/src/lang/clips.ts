/*
 * Soporte del lenguaje CLIPS para CodeMirror: coloreado y, sobre todo,
 * autocompletado que entiende dónde está el cursor.
 *
 * El autocompletado es la diferencia real con el IDE oficial. No sugiere una
 * lista fija de palabras: mira qué tienes alrededor y ofrece lo que tiene
 * sentido ahí — los slots de ESE template, las variables de ESA regla.
 */

import { StreamLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { SymbolIndex } from './symbols';
import { ruleAt } from './symbols';

const CONSTRUCTS = [
  'defrule', 'deftemplate', 'deffacts', 'deffunction', 'defglobal',
  'defclass', 'definstances', 'defmessage-handler', 'defmodule',
];

const BUILTINS = [
  'assert', 'retract', 'modify', 'duplicate', 'printout', 'bind', 'if', 'then',
  'else', 'while', 'loop-for-count', 'return', 'halt', 'focus', 'reset', 'run',
  'facts', 'agenda', 'rules', 'watch', 'unwatch', 'clear', 'load', 'save',
  'str-cat', 'str-index', 'str-length', 'sub-string', 'upcase', 'lowcase',
  'length$', 'nth$', 'member$', 'subsetp', 'create$', 'insert$', 'delete$',
  'first$', 'rest$', 'eq', 'neq', 'not', 'and', 'or', 'test', 'exists', 'forall',
  'gensym', 'read', 'readline', 'open', 'close', 'format', 'abs', 'min', 'max',
  'mod', 'div', 'sqrt', 'integer', 'float', 'round', 'numberp', 'stringp',
  'symbolp', 'evenp', 'oddp', 'make-instance', 'send', 'slot-set', 'slot-get',
];

const BUILTIN_SET = new Set([...CONSTRUCTS, ...BUILTINS]);

/* ------------------------------------------------------------------ */
/* Coloreado                                                           */
/* ------------------------------------------------------------------ */

const clipsStream = StreamLanguage.define<{ inString: boolean }>({
  name: 'clips',

  startState: () => ({ inString: false }),

  token(stream, state) {
    if (state.inString) {
      while (!stream.eol()) {
        if (stream.next() === '"') { state.inString = false; break; }
      }
      return 'string';
    }

    if (stream.eatSpace()) return null;

    const ch = stream.peek()!;

    if (ch === ';') { stream.skipToEnd(); return 'comment'; }

    if (ch === '"') {
      stream.next();
      state.inString = true;
      while (!stream.eol()) {
        if (stream.next() === '"') { state.inString = false; break; }
      }
      return 'string';
    }

    if (ch === '(' || ch === ')') { stream.next(); return 'bracket'; }

    // Variables: ?x, ?*global*, $?multi
    if (ch === '?' || ch === '$') {
      stream.next();
      stream.eatWhile(/[^\s()";]/);
      return 'variableName';
    }

    if (/[0-9]/.test(ch)) {
      stream.eatWhile(/[0-9.eE+-]/);
      return 'number';
    }

    if (stream.match('=>')) return 'operator';

    stream.eatWhile(/[^\s()";]/);
    const word = stream.current();

    if (CONSTRUCTS.includes(word)) return 'definitionKeyword';
    if (BUILTIN_SET.has(word)) return 'keyword';
    return 'atom';
  },

  tokenTable: {
    definitionKeyword: t.definitionKeyword,
    keyword: t.keyword,
    variableName: t.variableName,
    string: t.string,
    comment: t.lineComment,
    number: t.number,
    bracket: t.bracket,
    operator: t.operator,
    atom: t.name,
  },
});

export const clipsHighlight = HighlightStyle.define([
  { tag: t.definitionKeyword, color: 'var(--syn-construct)', fontWeight: '600' },
  { tag: t.keyword,           color: 'var(--syn-keyword)' },
  { tag: t.variableName,      color: 'var(--syn-variable)' },
  { tag: t.string,            color: 'var(--syn-string)' },
  { tag: t.lineComment,       color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.number,            color: 'var(--syn-number)' },
  { tag: t.operator,          color: 'var(--syn-arrow)', fontWeight: '700' },
  { tag: t.name,              color: 'var(--syn-name)' },
]);

/* ------------------------------------------------------------------ */
/* Contexto: ¿dentro de qué paréntesis estoy?                          */
/* ------------------------------------------------------------------ */

/**
 * Las cabeceras de todos los paréntesis abiertos que envuelven la posición,
 * de dentro hacia fuera. Hace falta la cadena entera y no solo la inmediata:
 * al escribir "(persona (" el paréntesis de dentro todavía está vacío y el
 * nombre del template está un nivel más arriba.
 */
function enclosing(text: string, pos: number): { heads: string[]; depth: number } {
  const heads: string[] = [];
  let closed = 0;

  for (let i = pos - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ')') closed++;
    else if (c === '(') {
      if (closed === 0) {
        const rest = text.slice(i + 1);
        heads.push((rest.match(/^\s*([^\s()]+)/) ?? [])[1] ?? '');
      } else {
        closed--;
      }
    }
  }

  return { heads, depth: heads.length };
}

/* ------------------------------------------------------------------ */
/* Autocompletado                                                      */
/* ------------------------------------------------------------------ */

const SNIPPETS = [
  snippetCompletion('(deftemplate ${nombre}\n   (slot ${slot1})\n   (slot ${slot2}))', {
    label: 'deftemplate', type: 'class', detail: 'plantilla de hechos',
  }),
  snippetCompletion('(defrule ${nombre}\n   ${patron}\n   =>\n   ${accion})', {
    label: 'defrule', type: 'function', detail: 'regla',
  }),
  snippetCompletion('(deffacts ${nombre}\n   ${hecho})', {
    label: 'deffacts', type: 'variable', detail: 'hechos iniciales',
  }),
  snippetCompletion('(deffunction ${nombre} (${?arg})\n   ${cuerpo})', {
    label: 'deffunction', type: 'function', detail: 'función',
  }),
];

/**
 * Devuelve las sugerencias para la posición del cursor. El orden de los
 * casos importa: van de lo más específico a lo más genérico, y en cuanto
 * uno encaja se corta. Sugerir de más es tan malo como no sugerir.
 */
export function clipsCompletions(getIndex: () => SymbolIndex) {
  return (context: CompletionContext): CompletionResult | null => {
    const index = getIndex();
    const text = context.state.doc.toString();
    const pos = context.pos;

    // 1. Variables: al escribir "?" ofrecemos las de ESTA regla, no todas.
    const variable = context.matchBefore(/\?[\w-]*/);
    if (variable) {
      const rule = ruleAt(text, pos);
      const options: Completion[] = [
        ...(rule?.variables ?? []).map((v) => ({
          label: `?${v}`, type: 'variable', detail: 'ligada en esta regla', boost: 10,
        })),
        ...[...index.globals].map((g) => ({
          label: `?*${g}*`, type: 'variable', detail: 'global',
        })),
      ];
      return options.length ? { from: variable.from, options } : null;
    }

    const word = context.matchBefore(/[^\s()";]*/);
    const from = word ? word.from : pos;
    const { heads, depth } = enclosing(text, pos);
    const head = heads[0] ?? '';

    // 2. Dentro de un patrón de template: sus slots, y solo los suyos.
    //    Vale tanto "(persona |" como "(persona (|", que es como se escribe
    //    de verdad: abres el paréntesis del slot antes de saber su nombre.
    const template = head !== ''
      ? index.templates.get(head)
      : index.templates.get(heads[1] ?? '');

    if (template && template.slots.length > 0) {
      return {
        from,
        options: template.slots.map((s) => ({
          label: s.name,
          type: 'property',
          detail: s.multi ? `multislot de ${template.name}` : `slot de ${template.name}`,
          apply: `(${s.name} )`,
          boost: 20,
        })),
      };
    }

    // 3. Nivel superior: ahí solo se pueden abrir construcciones.
    if (depth <= 1 && head === '') {
      return { from, options: SNIPPETS };
    }

    // 4. En cualquier otro sitio: templates, funciones y primitivas.
    const options: Completion[] = [
      ...[...index.templates.values()].map((s) => ({
        label: s.name, type: 'class', detail: `template (${s.slots.length} slots)`, boost: 5,
      })),
      ...[...index.functions.values()].map((s) => ({
        label: s.name, type: 'function', detail: `(${s.params.map((p) => '?' + p).join(' ')})`, boost: 5,
      })),
      ...[...index.rules.values()].map((s) => ({
        label: s.name, type: 'keyword', detail: 'regla',
      })),
      ...BUILTINS.map((b) => ({ label: b, type: 'keyword' as const })),
    ];

    return { from, options };
  };
}

export function clips(): LanguageSupport {
  return new LanguageSupport(clipsStream, [syntaxHighlighting(clipsHighlight)]);
}
