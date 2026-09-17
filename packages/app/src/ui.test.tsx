/*
 * Pruebas de la interfaz en DOM simulado.
 *
 * No sustituyen a mirar la pantalla, pero sí atrapan lo que más caro sale:
 * que la app no monte, que la tabla de hechos se descoloque cuando un hecho
 * trae menos slots que otro, o que un hecho ordenado (sin template) rompa el
 * agrupado.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { FactsPanel } from './components/FactsPanel';
import { AgendaPanel } from './components/AgendaPanel';
import type { FactRow, OperationResult, Request, Response, Snapshot } from './engine/protocol';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// El proyecto se guarda en localStorage, así que sin limpiar entre pruebas
// los ficheros de una se colarían en la siguiente.
beforeEach(() => localStorage.clear());

const fact = (index: number, template: string, slots: Record<string, string>): FactRow => ({
  index,
  template,
  slots,
  text: `(${template} ...)`,
});

function engineSnapshot(output: string, operation: OperationResult): Snapshot {
  return {
    output,
    facts: [],
    agenda: [],
    templates: [],
    operation,
  };
}

function unexpectedRequest(request: never): never {
  throw new TypeError(`Petición inesperada en la prueba: ${String(request)}`);
}

class FailedOperationsWorker {
  onmessage: ((event: MessageEvent<Response>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  postMessage(request: Request): void {
    switch (request.type) {
      case 'load':
        this.respond(request.id, engineSnapshot('ERROR DE CARGA', { type: 'load', ok: false }));
        return;
      case 'eval':
        this.respond(request.id, engineSnapshot('ERROR DE EVALUACIÓN', { type: 'eval', ok: false }));
        return;
      case 'run':
        this.respond(request.id, {
          ...engineSnapshot('NO DEBE EJECUTARSE', { type: 'none' }),
          fired: 1,
        });
        return;
      case 'reset':
      case 'snapshot':
        this.respond(request.id, engineSnapshot('', { type: 'none' }));
        return;
      default:
        return unexpectedRequest(request);
    }
  }

  terminate(): void {}

  private respond(id: number, snapshot: Snapshot): void {
    this.onmessage?.(new MessageEvent<Response>('message', {
      data: { id, ok: true, snapshot },
    }));
  }
}

describe('App', () => {
  it('monta con el proyecto de ejemplo y sus controles', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Ejecutar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Paso' })).toBeDefined();
    expect(screen.getByText('averias.clp')).toBeDefined();
  });

  it('muestra el esquema del fichero abierto', () => {
    render(<App />);
    // Acotado al lateral: el editor también pinta estos nombres, y lo que
    // se comprueba aquí es que el índice de símbolos los ha encontrado.
    const lateral = within(screen.getByRole('complementary'));
    expect(lateral.getByText('bateria-descargada')).toBeDefined();
    expect(lateral.getByText('sintoma')).toBeDefined();
  });

  it('deja arrastrar los dos divisores', () => {
    render(<App />);
    expect(screen.getByRole('separator', { name: 'Ancho de los paneles' })).toBeDefined();
    expect(screen.getByRole('separator', { name: 'Altura de la consola' })).toBeDefined();
  });

  it('ofrece navegación accesible entre las vistas compactas', () => {
    render(<App />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Código', 'Ficheros', 'Inferencia', 'Consola']);
    expect(screen.getByRole('tab', { name: 'Código' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Inferencia' }));

    expect(screen.getByRole('tab', { name: 'Inferencia' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Inferencia' })).toBeDefined();
  });

  it('recorre las vistas compactas con el teclado y vuelve al principio', () => {
    render(<App />);
    const codeTab = screen.getByRole('tab', { name: 'Código' });

    fireEvent.keyDown(codeTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Consola' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Consola' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Código' }).getAttribute('aria-selected')).toBe('true');
  });

  it('mantiene el proyecto modificado y no ejecuta después de una carga inválida', async () => {
    // Given
    vi.stubGlobal('Worker', FailedOperationsWorker);
    render(<App />);

    // When
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    });

    // Then
    expect(screen.getByText('ERROR DE CARGA')).toBeDefined();
    expect(screen.getByText('modificado')).toBeDefined();
    expect(screen.queryByText('NO DEBE EJECUTARSE')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('error de carga');
  });

  it('muestra la salida de una evaluación fallida y deja un estado de error', async () => {
    // Given
    vi.stubGlobal('Worker', FailedOperationsWorker);
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Consola' }));
    const input = document.querySelector<HTMLInputElement>('.console-input input');
    if (!input) throw new TypeError('La consola no tiene campo de entrada');
    const form = input.closest('form');
    if (!form) throw new TypeError('La consola no tiene formulario');

    // When
    await act(async () => {
      fireEvent.change(input, { target: { value: '(función-inexistente)' } });
      fireEvent.submit(form);
    });

    // Then
    expect(screen.getByText('ERROR DE EVALUACIÓN')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('error de evaluación');
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('error');
  });
});

describe('vista compacta', () => {
  // jsdom siempre responde que no a las media queries, así que sin fingir el
  // viewport estrecho las pestañas nunca llegan a ocultar nada y el modo
  // compacto quedaría sin probar.
  const original = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => { window.matchMedia = original; });

  it('deja visible exactamente una vista cada vez', () => {
    render(<App />);

    // getAllByRole ignora lo marcado con hidden, que es justo lo que queremos
    // comprobar: las demás vistas salen del árbol de accesibilidad.
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Código' })).toBeDefined();

    for (const vista of ['Ficheros', 'Inferencia', 'Consola']) {
      fireEvent.click(screen.getByRole('tab', { name: vista }));
      const visibles = screen.getAllByRole('tabpanel');
      expect(visibles).toHaveLength(1);
      expect(screen.getByRole('tabpanel', { name: vista })).toBeDefined();
    }
  });

  it('mantiene el fichero elegido al volver a la vista de código', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Ficheros' }));
    fireEvent.click(screen.getByText('caso.clp'));

    fireEvent.click(screen.getByRole('tab', { name: 'Código' }));
    const codigo = screen.getByRole('tabpanel', { name: 'Código' });
    expect(codigo.textContent).toContain('caso-actual');

    fireEvent.click(screen.getByRole('tab', { name: 'Ficheros' }));
    expect(screen.getByText('caso.clp').getAttribute('aria-current')).toBe('true');
  });
});

describe('FactsPanel', () => {
  const noop = () => {};

  it('agrupa por template y saca una columna por slot', () => {
    render(
      <FactsPanel
        facts={[
          fact(1, 'persona', { nombre: 'ana', edad: '20' }),
          fact(2, 'persona', { nombre: 'luis', edad: '12' }),
          fact(3, 'coche', { marca: 'seat' }),
        ]}
        added={new Set()}
        removed={new Set()}
        filter=""
        onFilter={noop}
      />,
    );

    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);

    const personas = tables.find((t) => within(t).queryByText('ana'))!;
    expect(within(personas).getByText('nombre')).toBeDefined();
    expect(within(personas).getByText('edad')).toBeDefined();
    expect(within(personas).getByText('luis')).toBeDefined();
  });

  it('no descoloca la fila cuando a un hecho le falta un slot', () => {
    render(
      <FactsPanel
        facts={[
          fact(1, 'persona', { nombre: 'ana', edad: '20' }),
          fact(2, 'persona', { nombre: 'luis' }),
        ]}
        added={new Set()}
        removed={new Set()}
        filter=""
        onFilter={noop}
      />,
    );

    const filas = screen.getAllByRole('row');
    // Cabecera + dos hechos, todas con el mismo número de celdas.
    const anchuras = filas.slice(1).map((r) => within(r).getAllByRole('cell').length);
    expect(anchuras).toEqual([3, 3]);
  });

  it('muestra los hechos ordenados como texto, sin columnas', () => {
    render(
      <FactsPanel
        facts={[{ index: 1, template: 'initial-fact', text: '(initial-fact)', slots: {} }]}
        added={new Set()}
        removed={new Set()}
        filter=""
        onFilter={noop}
      />,
    );
    expect(screen.getByText('(initial-fact)')).toBeDefined();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });

  it('dice si un hecho es nuevo o retractado sin depender del color', () => {
    // DESIGN.md: el estado nunca se comunica solo con color. Estas señales
    // son las que sobreviven en escala de grises y con lector de pantalla.
    render(
      <FactsPanel
        facts={[fact(1, 'persona', { nombre: 'ana' }), fact(2, 'persona', { nombre: 'luis' })]}
        added={new Set([1])}
        removed={new Set([2])}
        filter=""
        onFilter={() => {}}
      />,
    );

    expect(screen.getByText('(nuevo)')).toBeDefined();
    expect(screen.getByText('(retractado)')).toBeDefined();
    expect(screen.getByText('+')).toBeDefined();
    expect(screen.getByText('\u2212')).toBeDefined();
  });

  it('el filtro deja solo lo que coincide', () => {
    render(
      <FactsPanel
        facts={[
          fact(1, 'persona', { nombre: 'ana' }),
          fact(2, 'coche', { marca: 'seat' }),
        ]}
        added={new Set()}
        removed={new Set()}
        filter="coche"
        onFilter={noop}
      />,
    );
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('seat')).toBeDefined();
  });

  it('cuenta solo los hechos vivos, no los retractados', () => {
    render(
      <FactsPanel
        facts={[fact(1, 'persona', { nombre: 'ana' }), fact(2, 'persona', { nombre: 'luis' })]}
        added={new Set()}
        removed={new Set([2])}
        filter=""
        onFilter={noop}
      />,
    );
    expect(screen.getByText('1')).toBeDefined();
  });
});

describe('AgendaPanel', () => {
  it('destaca la activación que se disparará y deja ver sus hechos', () => {
    render(
      <AgendaPanel
        agenda={[
          { rule: 'saludar', salience: 0, text: '   0      saludar: f-1,f-2' },
          { rule: 'informar', salience: -10, text: ' -10      informar: f-3' },
        ]}
        loaded
        onGoToRule={() => {}}
      />,
    );

    const primera = screen.getByRole('button', { name: /saludar/ });
    expect(primera.className).toContain('activation-next');
    expect(within(primera).getByText('f-1 f-2')).toBeDefined();

    // El salience solo se enseña cuando no es el de por defecto.
    expect(screen.getByText('salience -10')).toBeDefined();
  });

  it('dice qué hacer cuando todavía no se ha cargado nada', () => {
    render(<AgendaPanel agenda={[]} loaded={false} onGoToRule={() => {}} />);
    expect(screen.getByText(/Pulsa Ejecutar/)).toBeDefined();
  });
});

/** Un evento de arrastre con ficheros, que jsdom no construye por su cuenta. */
function dragEvent(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files, dropEffect: '' },
  });
  return event;
}

const clp = (name: string, text: string) => new File([text], name, { type: 'text/plain' });

describe('subir ficheros', () => {
  it('ofrece el botón de subir con su nombre escrito', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Subir .clp' })).toBeDefined();
    expect(screen.getByText(/arrastra tus .clp/i)).toBeDefined();
  });

  it('avisa de dónde soltar mientras arrastras', async () => {
    render(<App />);
    expect(screen.queryByText(/Suelta aquí/)).toBeNull();

    await act(async () => { window.dispatchEvent(dragEvent('dragenter')); });
    expect(screen.getByText(/Suelta aquí/)).toBeDefined();

    await act(async () => { window.dispatchEvent(dragEvent('dragleave')); });
    expect(screen.queryByText(/Suelta aquí/)).toBeNull();
  });

  it('añade el fichero soltado y lo abre', async () => {
    render(<App />);
    const aside = within(screen.getByRole('complementary'));
    expect(aside.queryByText('practica3.clp')).toBeNull();

    await act(async () => {
      window.dispatchEvent(dragEvent('drop', [clp('practica3.clp', '(defrule mia => )')]));
    });

    expect(aside.getByText('practica3.clp')).toBeDefined();
    // Y su contenido ya está indexado: el esquema lo demuestra.
    expect(aside.getByText('mia')).toBeDefined();
  });

  it('reemplaza el fichero si ya existía con ese nombre', async () => {
    render(<App />);
    await act(async () => {
      window.dispatchEvent(dragEvent('drop', [clp('averias.clp', '(defrule sustituida => )')]));
    });

    const aside = within(screen.getByRole('complementary'));
    expect(aside.getAllByText('averias.clp')).toHaveLength(1);
    expect(aside.getByText('sustituida')).toBeDefined();
    expect(aside.queryByText('bateria-descargada')).toBeNull();
  });

  it('ignora lo que no sea CLIPS y lo dice', async () => {
    render(<App />);
    await act(async () => {
      window.dispatchEvent(dragEvent('drop', [clp('foto.png', 'binario')]));
    });

    expect(screen.getByText(/Ignorados por no ser ficheros CLIPS: foto.png/)).toBeDefined();
    expect(within(screen.getByRole('complementary')).queryByText('foto.png')).toBeNull();
  });

  it('acepta varios a la vez', async () => {
    render(<App />);
    await act(async () => {
      window.dispatchEvent(dragEvent('drop', [
        clp('uno.clp', '(defrule uno => )'),
        clp('dos.clp', '(defrule dos => )'),
      ]));
    });

    const aside = within(screen.getByRole('complementary'));
    expect(aside.getByText('uno.clp')).toBeDefined();
    expect(aside.getByText('dos.clp')).toBeDefined();
  });
});
