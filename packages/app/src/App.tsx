import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { Console, type ConsoleLine } from './components/Console';
import { CommandBar } from './components/CommandBar';
import { ProjectRail } from './components/ProjectRail';
import { InferencePanel } from './components/InferencePanel';
import { WorkspaceTabs, type WorkspaceView } from './components/WorkspaceTabs';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { useSplit } from './hooks/useSplit';
import { useFileDrop, type DroppedFile } from './hooks/useFileDrop';
import { useCompactWorkspace } from './hooks/useCompactWorkspace';
import { ClipsClient } from './engine/client';
import type { ClipsFile, FactRow, Snapshot } from './engine/protocol';
import { buildIndex, emptyIndex } from './lang/symbols';
import { EXAMPLE_PROJECT } from './example';

const STORAGE_KEY = 'clips2.project';

function unexpectedOperation(operation: never): never {
  throw new TypeError(`Resultado de operación desconocido: ${String(operation)}`);
}

function loadProject(): ClipsFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Un proyecto guardado ilegible no debe impedir abrir el IDE.
  }
  return EXAMPLE_PROJECT;
}

const MOD = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

export default function App() {
  const [files, setFiles] = useState<ClipsFile[]>(loadProject);
  const [active, setActive] = useState(() => loadProject()[0].name);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [removed, setRemoved] = useState<FactRow[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [status, setStatus] = useState<{ text: string; tone?: 'ok' | 'error' }>({ text: 'sin cargar' });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [filter, setFilter] = useState('');
  const [goTo, setGoTo] = useState<{ line: number; nonce: number }>();
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('code');

  const client = useRef(new ClipsClient());
  const previousFacts = useRef<FactRow[]>([]);

  const panelsSplit = useSplit({ key: 'panels', initial: 320, min: 220, max: 560, axis: 'x' });
  const consoleSplit = useSplit({ key: 'console', initial: 200, min: 90, max: 460, axis: 'y' });
  const compact = useCompactWorkspace();

  const index = useMemo(() => buildIndex(files), [files]);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  const getIndex = useCallback(() => indexRef.current ?? emptyIndex(), []);

  const activeFile = files.find((f) => f.name === active) ?? files[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  const say = useCallback((text: string, kind: ConsoleLine['kind'] = 'out') => {
    if (text.trim().length === 0) return;
    setLines((prev) => [...prev, { text, kind }]);
  }, []);

  /** Aplica un snapshot y calcula qué hechos han entrado y salido. */
  const apply = useCallback((next: Snapshot) => {
    const before = previousFacts.current;
    const beforeIds = new Set(before.map((f) => f.index));
    const afterIds = new Set(next.facts.map((f) => f.index));

    setAdded(new Set(next.facts.filter((f) => !beforeIds.has(f.index)).map((f) => f.index)));
    setRemoved(before.filter((f) => !afterIds.has(f.index)));

    previousFacts.current = next.facts;
    setSnapshot(next);
    say(next.output);
  }, [say]);

  const guard = useCallback(async (label: string, work: () => Promise<Snapshot>) => {
    setBusy(true);
    setStatus({ text: label });
    try {
      const next = await work();
      apply(next);
      return next;
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), 'err');
      setStatus({ text: 'detenido', tone: 'error' });
      setDirty(true);
      return null;
    } finally {
      setBusy(false);
    }
  }, [apply, say]);

  const load = useCallback(async () => {
    previousFacts.current = [];
    const next = await guard('cargando…', () => client.current.load(files));
    if (!next) return false;

    switch (next.operation.type) {
      case 'load':
        if (!next.operation.ok) {
          setDirty(true);
          setStatus({ text: 'error de carga', tone: 'error' });
          return false;
        }
        setDirty(false);
        return true;
      case 'eval':
      case 'none':
        setDirty(true);
        setStatus({ text: 'respuesta de carga inesperada', tone: 'error' });
        return false;
      default:
        return unexpectedOperation(next.operation);
    }
  }, [files, guard]);

  const handleRun = useCallback(async () => {
    if (!(await load())) return;
    const ok = await guard('ejecutando…', () => client.current.run(-1));
    if (ok) setStatus({ text: 'ejecutado', tone: 'ok' });
  }, [load, guard]);

  const handleStep = useCallback(async () => {
    if (dirty && !(await load())) return;
    const ok = await guard('paso', () => client.current.step());
    if (ok) setStatus({ text: 'un disparo', tone: 'ok' });
  }, [dirty, load, guard]);

  const handleReset = useCallback(async () => {
    previousFacts.current = [];
    const ok = await guard('reiniciando…', () => client.current.reset());
    if (ok) setStatus({ text: 'reiniciado' });
  }, [guard]);

  const handleStop = useCallback(() => {
    client.current.stop();
    setBusy(false);
    setDirty(true);
    setStatus({ text: 'detenido', tone: 'error' });
    say('Ejecución detenida. El entorno se ha reiniciado: vuelve a cargar.', 'err');
  }, [say]);

  // Atajos: un IDE en el que hay que ir al ratón para ejecutar no es un IDE.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === 'Enter') { event.preventDefault(); void handleRun(); }
      else if (mod && event.key === '.') { event.preventDefault(); void handleStep(); }
      else if (mod && event.key === 'Backspace') { event.preventDefault(); void handleReset(); }
      else if (event.key === 'Escape' && busy) { event.preventDefault(); handleStop(); }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun, handleStep, handleReset, handleStop, busy]);

  const jumpTo = (line: number) => setGoTo({ line, nonce: Date.now() });

  const jumpToRule = (rule: string) => {
    const symbol = index.rules.get(rule);
    if (!symbol) return;
    if (symbol.file !== active) setActive(symbol.file);
    jumpTo(symbol.line);
  };

  /* --- Ficheros: entrar y salir del navegador sin fricción --- */

  /** Punto único de entrada: da igual si vienen del diálogo o de un arrastre. */
  const addIncoming = useCallback((incoming: DroppedFile[]) => {
    if (incoming.length === 0) return;

    const replaced: string[] = [];
    setFiles((prev) => {
      const merged = [...prev];
      for (const file of incoming) {
        const at = merged.findIndex((f) => f.name === file.name);
        if (at >= 0) { merged[at] = file; replaced.push(file.name); }
        else merged.push(file);
      }
      return merged;
    });

    setActive(incoming[0].name);
    setDirty(true);
    say(`Abierto: ${incoming.map((f) => f.name).join(', ')}`, 'echo');
    if (replaced.length > 0) {
      say(`Se ha reemplazado el contenido de ${replaced.join(', ')}.`, 'echo');
    }
  }, [say]);

  const openFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    addIncoming(
      await Promise.all([...list].map(async (file) => ({ name: file.name, text: await file.text() }))),
    );
  };

  const onRejected = useCallback((names: string[]) => {
    say(`Ignorados por no ser ficheros CLIPS: ${names.join(', ')}`, 'err');
  }, [say]);

  const dragging = useFileDrop({ onFiles: addIncoming, onRejected });

  const saveActive = () => {
    if (!activeFile) return;
    const url = URL.createObjectURL(new Blob([activeFile.text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addFile = () => {
    const name = prompt('Nombre del fichero', 'nuevo.clp');
    if (!name) return;
    if (files.some((f) => f.name === name)) {
      say(`Ya existe un fichero llamado ${name}.`, 'err');
      return;
    }
    setFiles((prev) => [...prev, { name, text: '' }]);
    setActive(name);
  };

  const outline = useMemo(
    () => index.all.filter((s) => s.file === activeFile?.name),
    [index, activeFile],
  );

  // Los retractados se muestran junto a los vivos: en el paso a paso, ver lo
  // que desapareció importa tanto como ver lo que hay.
  const removedIds = useMemo(() => new Set(removed.map((f) => f.index)), [removed]);
  const allFacts = useMemo(
    () => [...(snapshot?.facts ?? []), ...removed].sort((a, b) => a.index - b.index),
    [snapshot, removed],
  );

  return (
    <WorkspaceLayout
      style={{
        '--panels-w': `${panelsSplit.size}px`,
        '--console-h': `${consoleSplit.size}px`,
      } as React.CSSProperties}
      compact={compact}
      activeView={workspaceView}
      panelsSplitter={panelsSplit}
      consoleSplitter={consoleSplit}
      commandBar={<CommandBar
        activeFile={activeFile?.name ?? 'Sin fichero'}
        busy={busy}
        dirty={dirty}
        modifier={MOD}
        status={status}
        onRun={() => { void handleRun(); }}
        onStep={() => { void handleStep(); }}
        onReset={() => { void handleReset(); }}
        onStop={handleStop}
      />}
      tabs={<WorkspaceTabs active={workspaceView} onChange={setWorkspaceView} />}
      files={<ProjectRail
          files={files}
          active={active}
          activeFileExists={Boolean(activeFile)}
          outline={outline}
          onChooseFile={setActive}
          onUpload={(incoming) => { void openFiles(incoming); }}
          onAddFile={addFile}
          onSaveFile={saveActive}
          onJump={jumpTo}
        />}
      code={<>
        <div className="region-head editor-head">
          <span>Documento · {activeFile?.name ?? 'Sin fichero'}</span>
          <span className="region-meta">{dirty ? 'modificado' : 'cargado'}</span>
        </div>
        <Editor
          text={activeFile?.text ?? ''}
          getIndex={getIndex}
          goTo={goTo}
          onChange={(text) => {
            setDirty(true);
            setFiles((prev) => prev.map((f) => (f.name === active ? { ...f, text } : f)));
          }}
        />
      </>}
      inference={<InferencePanel
          agenda={snapshot?.agenda ?? []}
          loaded={snapshot !== null}
          facts={allFacts}
          added={added}
          removed={removedIds}
          filter={filter}
          onFilter={setFilter}
          onGoToRule={jumpToRule}
        />}
      dropOverlay={dragging ? (
        <div className="drop-overlay">
          <div className="drop-card">
            <strong>Suelta aquí tus ficheros</strong>
            <span>.clp · los que ya existan se reemplazan</span>
          </div>
        </div>
      ) : null}
      console={<Console
          lines={lines}
          disabled={busy}
          onSubmit={async (command) => {
            say(`CLIPS> ${command}`, 'echo');
            const next = await guard('evaluando…', () => client.current.evaluate(command));
            if (!next) return;

            switch (next.operation.type) {
              case 'eval':
                setStatus(next.operation.ok
                  ? { text: 'listo' }
                  : { text: 'error de evaluación', tone: 'error' });
                return;
              case 'load':
              case 'none':
                setStatus({ text: 'respuesta de evaluación inesperada', tone: 'error' });
                return;
              default:
                return unexpectedOperation(next.operation);
            }
          }}
        />}
    />
  );
}
