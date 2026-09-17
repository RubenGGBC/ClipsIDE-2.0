import type { CSSProperties, KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react';
import type { WorkspaceView } from './WorkspaceTabs';

interface SplitterProps {
  readonly onPointerDown: PointerEventHandler<HTMLDivElement>;
  readonly onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

interface Props {
  readonly style: CSSProperties;
  readonly compact: boolean;
  readonly activeView: WorkspaceView;
  readonly commandBar: ReactNode;
  readonly tabs: ReactNode;
  readonly files: ReactNode;
  readonly code: ReactNode;
  readonly inference: ReactNode;
  readonly console: ReactNode;
  readonly dropOverlay: ReactNode;
  readonly panelsSplitter: SplitterProps;
  readonly consoleSplitter: SplitterProps;
}

function paneIsHidden(compact: boolean, active: WorkspaceView, pane: WorkspaceView): boolean {
  return compact && active !== pane;
}

export function WorkspaceLayout(props: Props) {
  return (
    <div className="app" style={props.style}>
      {props.commandBar}
      {props.tabs}

      <div
        id="panel-files"
        className="workspace-pane files-pane"
        role="tabpanel"
        aria-labelledby="tab-files"
        hidden={paneIsHidden(props.compact, props.activeView, 'files')}
      >
        {props.files}
      </div>

      <div
        id="panel-code"
        className="workspace-pane code-pane"
        role="tabpanel"
        aria-labelledby="tab-code"
        hidden={paneIsHidden(props.compact, props.activeView, 'code')}
      >
        {props.code}
      </div>

      <div
        className="split split-x"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ancho de los paneles"
        tabIndex={0}
        onPointerDown={props.panelsSplitter.onPointerDown}
        onKeyDown={props.panelsSplitter.onKeyDown}
      />

      <div
        className="split split-y"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Altura de la consola"
        tabIndex={0}
        onPointerDown={props.consoleSplitter.onPointerDown}
        onKeyDown={props.consoleSplitter.onKeyDown}
      />

      <div
        id="panel-inference"
        className="workspace-pane inference-pane"
        role="tabpanel"
        aria-labelledby="tab-inference"
        hidden={paneIsHidden(props.compact, props.activeView, 'inference')}
      >
        {props.inference}
      </div>

      {props.dropOverlay}

      <div
        id="panel-console"
        className="workspace-pane console-pane"
        role="tabpanel"
        aria-labelledby="tab-console"
        hidden={paneIsHidden(props.compact, props.activeView, 'console')}
      >
        {props.console}
      </div>
    </div>
  );
}
