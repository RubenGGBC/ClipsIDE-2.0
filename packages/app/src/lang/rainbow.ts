/*
 * Paréntesis de colores por profundidad.
 *
 * En un lenguaje donde todo son paréntesis, el color de profundidad no es
 * adorno: es la única pista rápida de si el patrón que estás escribiendo
 * está al nivel que crees. Solo se pintan las líneas visibles, así que un
 * fichero largo no cuesta más que uno corto.
 */

import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const DEPTHS = 5;

const marks = Array.from({ length: DEPTHS }, (_, i) =>
  Decoration.mark({ class: `cm-paren-${i}` }),
);

const unmatched = Decoration.mark({ class: 'cm-paren-bad' });

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // La profundidad real depende de todo lo anterior del documento, no solo
    // de lo que se ve, así que la contamos desde el principio del fichero.
    let depth = countDepth(view.state.doc.sliceString(0, from));
    let inString = false;
    let inComment = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (inComment) {
        if (c === '\n') inComment = false;
        continue;
      }
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
        continue;
      }

      if (c === ';') { inComment = true; continue; }
      if (c === '"') { inString = true; continue; }

      if (c === '(') {
        builder.add(from + i, from + i + 1, marks[depth % DEPTHS]);
        depth++;
      } else if (c === ')') {
        depth--;
        if (depth < 0) {
          builder.add(from + i, from + i + 1, unmatched);
          depth = 0;
        } else {
          builder.add(from + i, from + i + 1, marks[depth % DEPTHS]);
        }
      }
    }
  }

  return builder.finish();
}

function countDepth(text: string): number {
  let depth = 0;
  let inString = false;
  let inComment = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inComment) { if (c === '\n') inComment = false; continue; }
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === ';') { inComment = true; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
  }

  return depth;
}

export const rainbowParens = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
