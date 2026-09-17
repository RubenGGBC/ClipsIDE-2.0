/*
 * La consola REPL. Sigue existiendo porque en CLIPS media asignatura se hace
 * a mano desde el prompt — pero con historial, que el IDE oficial no tiene.
 */

import { useEffect, useRef, useState } from 'react';

export interface ConsoleLine {
  text: string;
  kind: 'out' | 'echo' | 'err';
}

interface Props {
  lines: ConsoleLine[];
  disabled: boolean;
  onSubmit: (command: string) => void;
}

export function Console({ lines, disabled, onSubmit }: Props) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  // -1 significa "escribiendo algo nuevo", no navegando el historial.
  const [cursor, setCursor] = useState(-1);
  const outRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Asignar scrollTop y no scrollTo(): la segunda no existe en todos los
    // entornos y aquí no necesitamos nada más que ir al final.
    const out = outRef.current;
    if (out) out.scrollTop = out.scrollHeight;
  }, [lines]);

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const text = command.trim();
    if (!text || disabled) return;

    setHistory((prev) => (prev[0] === text ? prev : [text, ...prev]));
    setCursor(-1);
    setCommand('');
    onSubmit(text);
  };

  const navigate = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (history.length === 0) return;

    event.preventDefault();
    const next = event.key === 'ArrowUp'
      ? Math.min(cursor + 1, history.length - 1)
      : cursor - 1;

    setCursor(next);
    setCommand(next < 0 ? '' : history[next]);
  };

  return (
    <section className="console">
      <pre className="console-out" ref={outRef}>
        {lines.map((line, i) => (
          <span
            key={i}
            className={
              line.kind === 'echo' ? 'console-echo' : line.kind === 'err' ? 'console-err' : undefined
            }
          >
            {line.text.endsWith('\n') ? line.text : `${line.text}\n`}
          </span>
        ))}
      </pre>

      <form className="console-input" onSubmit={submit}>
        <span className="console-prompt">CLIPS&gt;</span>
        <input
          value={command}
          onChange={(e) => { setCommand(e.target.value); setCursor(-1); }}
          onKeyDown={navigate}
          placeholder="(facts)   ↑ historial"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
        />
      </form>
    </section>
  );
}
