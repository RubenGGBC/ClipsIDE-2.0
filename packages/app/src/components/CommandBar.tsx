interface Status {
  readonly text: string;
  readonly tone?: 'ok' | 'error';
}

interface Props {
  readonly activeFile: string;
  readonly busy: boolean;
  readonly dirty: boolean;
  readonly modifier: string;
  readonly status: Status;
  readonly onRun: () => void;
  readonly onStep: () => void;
  readonly onReset: () => void;
  readonly onStop: () => void;
}

export function CommandBar(props: Props) {
  return (
    <header className="bar">
      <div className="brand-block">
        <div className="brand">CLIPS<span>2.0</span></div>
        <span className="active-document">Activo: {props.activeFile}</span>
      </div>
      <div className="command-actions" aria-label="Controles de ejecución">
        <button className="btn btn-run" onClick={props.onRun} disabled={props.busy} title={`${props.modifier}↵`}>
          <span aria-hidden="true">▶</span> Ejecutar
        </button>
        <button className="btn" onClick={props.onStep} disabled={props.busy} title={`${props.modifier}.`}>
          Paso
        </button>
        <button className="btn" onClick={props.onReset} disabled={props.busy} title={`${props.modifier}⌫`}>
          Reiniciar
        </button>
        <button className="btn btn-stop" onClick={props.onStop} disabled={!props.busy} title="Esc">
          Detener
        </button>
      </div>
      <div className="status" data-tone={props.status.tone} role="status">
        <span className="status-dot" aria-hidden="true" />
        {props.status.text}
        {props.dirty && props.status.tone !== 'error' && <span className="status-dirty"> · sin cargar</span>}
      </div>
    </header>
  );
}
