import { useEffect, useState } from 'react';

const QUERY = '(max-width: 900px)';

export function useCompactWorkspace(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(QUERY);
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
}
