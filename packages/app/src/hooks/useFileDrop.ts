/*
 * Soltar ficheros .clp sobre la ventana.
 *
 * Es la forma en que la gente espera meter un fichero en algo que se abre en
 * el navegador, así que va sobre toda la ventana y no sobre una zona pequeña
 * que haya que acertar.
 */

import { useEffect, useState } from 'react';

const ACCEPTED = /\.(clp|txt|bat)$/i;

export interface DroppedFile {
  name: string;
  text: string;
}

interface Options {
  onFiles: (files: DroppedFile[]) => void;
  /** Se avisa de lo que se ha ignorado; si no, el usuario cree que falló. */
  onRejected: (names: string[]) => void;
}

export function useFileDrop({ onFiles, onRejected }: Options) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // dragleave salta también al pasar por encima de cada hijo, así que hay
    // que contar entradas y salidas en vez de fiarse de un solo evento.
    let depth = 0;

    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const onEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth++;
      setDragging(true);
    };

    const onOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      // Sin esto el navegador abre el fichero en lugar de dárnoslo.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const onLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };

    const onDrop = async (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);

      const dropped = Array.from(event.dataTransfer?.files ?? []);
      const accepted = dropped.filter((f) => ACCEPTED.test(f.name));
      const rejected = dropped.filter((f) => !ACCEPTED.test(f.name));

      if (rejected.length > 0) onRejected(rejected.map((f) => f.name));
      if (accepted.length === 0) return;

      onFiles(
        await Promise.all(accepted.map(async (f) => ({ name: f.name, text: await f.text() }))),
      );
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles, onRejected]);

  return dragging;
}
