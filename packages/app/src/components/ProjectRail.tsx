import { useRef, type ChangeEvent } from 'react';
import type { ClipsFile } from '../engine/protocol';
import type { ClipsSymbol } from '../lang/symbols';

interface Props {
  readonly files: readonly ClipsFile[];
  readonly active: string;
  readonly activeFileExists: boolean;
  readonly outline: readonly ClipsSymbol[];
  readonly onChooseFile: (name: string) => void;
  readonly onUpload: (files: FileList | null) => void;
  readonly onAddFile: () => void;
  readonly onSaveFile: () => void;
  readonly onJump: (line: number) => void;
}

function symbolMark(kind: ClipsSymbol['kind']): string {
  if (kind === 'deftemplate') return '▣';
  if (kind === 'defrule') return '▸';
  return 'ƒ';
}

export function ProjectRail(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    props.onUpload(event.target.files);
    event.target.value = '';
  };

  return (
    <aside className="side" aria-label="Proyecto">
      <div className="rail-title">Proyecto</div>
      <div className="section-head"><span>Ficheros</span><span>{props.files.length}</span></div>
      <div className="file-actions">
        <button className="chip" onClick={() => fileInput.current?.click()}>Subir .clp</button>
        <button className="chip" onClick={props.onAddFile}>Nuevo</button>
        <button className="chip" onClick={props.onSaveFile} disabled={!props.activeFileExists}>Descargar</button>
      </div>
      <input ref={fileInput} type="file" accept=".clp,.txt,.bat" multiple hidden onChange={upload} />
      <div className="file-list">
        {props.files.map((file) => (
          <button
            key={file.name}
            className="file"
            aria-current={file.name === props.active}
            onClick={() => props.onChooseFile(file.name)}
          >
            <span aria-hidden="true">◇</span>{file.name}
          </button>
        ))}
      </div>
      <p className="side-hint">O arrastra tus .clp a la ventana.</p>
      <div className="section-head"><span>Esquema</span><span>{props.outline.length}</span></div>
      {props.outline.length === 0 && <p className="empty">Nada definido todavía.</p>}
      {props.outline.map((symbol) => (
        <button
          key={`${symbol.kind}-${symbol.name}`}
          className="outline-item"
          onClick={() => props.onJump(symbol.line)}
        >
          <span className="outline-kind" data-kind={symbol.kind} aria-hidden="true">{symbolMark(symbol.kind)}</span>
          <span className="outline-name">{symbol.name}</span>
        </button>
      ))}
    </aside>
  );
}
