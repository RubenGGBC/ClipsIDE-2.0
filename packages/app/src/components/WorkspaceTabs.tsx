import { useRef, type KeyboardEvent } from 'react';

export type WorkspaceView = 'code' | 'files' | 'inference' | 'console';

const TABS: readonly { id: WorkspaceView; label: string }[] = [
  { id: 'code', label: 'Código' },
  { id: 'files', label: 'Ficheros' },
  { id: 'inference', label: 'Inferencia' },
  { id: 'console', label: 'Consola' },
];

interface Props {
  readonly active: WorkspaceView;
  readonly onChange: (view: WorkspaceView) => void;
}

export function WorkspaceTabs({ active, onChange }: Props) {
  const refs = useRef(new Map<WorkspaceView, HTMLButtonElement>());

  const select = (view: WorkspaceView) => {
    onChange(view);
    refs.current.get(view)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: WorkspaceView) => {
    const index = TABS.findIndex((tab) => tab.id === current);
    let next: WorkspaceView | undefined;

    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length].id;
    if (event.key === 'ArrowLeft') next = TABS[(index - 1 + TABS.length) % TABS.length].id;
    if (event.key === 'Home') next = TABS[0].id;
    if (event.key === 'End') next = TABS[TABS.length - 1].id;
    if (!next) return;

    event.preventDefault();
    select(next);
  };

  return (
    <nav className="workspace-tabs" aria-label="Vistas del espacio de trabajo">
      <div role="tablist" aria-label="Navegación del espacio de trabajo">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) refs.current.set(tab.id, element);
              else refs.current.delete(tab.id);
            }}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onKeyDown(event, tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
