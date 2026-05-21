import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pulse-help-dismissed';

const controls = [
  { action: 'Orbit', key: 'Left-click + drag' },
  { action: 'Zoom', key: 'Scroll wheel' },
  { action: 'Pan', key: 'Right-click + drag' },
];

const interactions = [
  { action: 'Select hole', key: 'Click hole or label' },
  { action: 'Deselect', key: 'Click empty space' },
  { action: 'Zoom to cluster', key: 'Click cluster label' },
];

export function HelpPopup() {
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const popupRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, dismiss]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`rounded px-2.5 py-1.5 text-xs transition-colors ${
          open
            ? 'bg-blue-900/60 text-blue-200'
            : 'bg-bg-raised text-text-secondary hover:bg-bg-surface hover:text-text-primary'
        }`}
      >
        ?
      </button>
      {open && (
        <div
          ref={popupRef}
          className="absolute right-12 top-3 z-50 w-56 rounded bg-bg-raised/95 p-3 shadow-lg backdrop-blur-sm"
        >
          <div className="mb-2 text-xs font-medium text-text-primary">Controls</div>
          <table className="w-full text-[11px]">
            <tbody>
              {controls.map((c) => (
                <tr key={c.action}>
                  <td className="py-0.5 pr-3 text-text-muted">{c.action}</td>
                  <td className="py-0.5 text-text-secondary">{c.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mb-2 mt-3 text-xs font-medium text-text-primary">Interaction</div>
          <table className="w-full text-[11px]">
            <tbody>
              {interactions.map((c) => (
                <tr key={c.action}>
                  <td className="py-0.5 pr-3 text-text-muted">{c.action}</td>
                  <td className="py-0.5 text-text-secondary">{c.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={dismiss}
            className="mt-3 w-full rounded bg-bg-surface py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
          >
            Got it
          </button>
        </div>
      )}
    </>
  );
}
