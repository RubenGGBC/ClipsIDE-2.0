/*
 * Divisores arrastrables entre zonas del IDE.
 *
 * Un tamaño fijo siempre le va mal a alguien: en una práctica con muchos
 * hechos quieres el panel ancho, y depurando una regla larga quieres el
 * editor. El tamaño se guarda para no tener que recolocarlo cada día.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Clave de almacenamiento; también identifica el divisor. */
  key: string;
  initial: number;
  min: number;
  max: number;
  /** 'x' mide desde la derecha de la ventana, 'y' desde abajo. */
  axis: 'x' | 'y';
}

export function useSplit({ key, initial, min, max, axis }: Options) {
  const storageKey = `clips2.split.${key}`;
  const [size, setSize] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= min && saved <= max ? saved : initial;
  });

  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem(storageKey, String(size));
  }, [size, storageKey]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const next = axis === 'x'
        ? window.innerWidth - event.clientX
        : window.innerHeight - event.clientY;
      setSize(Math.min(max, Math.max(min, next)));
    };

    const up = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [axis, min, max]);

  const onPointerDown = useCallback(() => {
    dragging.current = true;
    // Sin esto, arrastrar rápido selecciona texto del editor por el camino.
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [axis]);

  /** Teclado: los divisores también deben moverse sin ratón. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? 40 : 10;
      const decrease = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      const increase = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';

      if (event.key === decrease) setSize((s) => Math.max(min, s - step));
      else if (event.key === increase) setSize((s) => Math.min(max, s + step));
      else return;

      event.preventDefault();
    },
    [axis, min, max],
  );

  return { size, onPointerDown, onKeyDown };
}
