/*
 * Envoltorio de CodeMirror. Mantiene una sola instancia viva y le va
 * cambiando el contenido: recrear el editor en cada pulsación perdería el
 * cursor, el historial de deshacer y el scroll.
 */

import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { clips, clipsCompletions } from '../lang/clips';
import { rainbowParens } from '../lang/rainbow';
import type { SymbolIndex } from '../lang/symbols';

interface Props {
  text: string;
  onChange: (text: string) => void;
  /** Se lee en cada sugerencia, así el autocompletado nunca va desfasado. */
  getIndex: () => SymbolIndex;
  /** Línea a la que saltar; cambiar el objeto fuerza el salto otra vez. */
  goTo?: { line: number; nonce: number };
}

export function Editor({ text, onChange, getIndex, goTo }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;

    const theme = new Compartment();

    const state = EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [clipsCompletions(getIndex)], activateOnTyping: true }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        clips(),
        rainbowParens,
        theme.of(EditorView.theme({}, { dark: true })),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const created = new EditorView({ state, parent: host.current });
    view.current = created;

    return () => {
      created.destroy();
      view.current = null;
    };
    // Se monta una sola vez: los cambios de texto entran por el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el documento cuando el cambio viene de fuera (cambiar de
  // fichero, importar un proyecto), nunca cuando viene del propio teclado.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === text) return;
    v.dispatch({ changes: { from: 0, to: current.length, insert: text } });
  }, [text]);

  useEffect(() => {
    const v = view.current;
    if (!v || !goTo) return;
    const line = v.state.doc.line(Math.min(goTo.line, v.state.doc.lines));
    v.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    });
    v.focus();
  }, [goTo]);

  return <div className="editor" ref={host} />;
}
