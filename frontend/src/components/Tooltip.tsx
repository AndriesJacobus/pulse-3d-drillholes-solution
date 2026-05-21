import { useState, useRef, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'left' | 'bottom';
}

export function Tooltip({ text, children, position = 'left' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    timeout.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    clearTimeout(timeout.current);
    setVisible(false);
  };

  const positionClasses =
    position === 'bottom'
      ? 'left-1/2 top-full mt-2 -translate-x-1/2'
      : 'right-full top-1/2 mr-2 -translate-y-1/2';

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded bg-bg-base/95 px-2 py-1 text-[11px] text-text-secondary shadow-lg ${positionClasses}`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
