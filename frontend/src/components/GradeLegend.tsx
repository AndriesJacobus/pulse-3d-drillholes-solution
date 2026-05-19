import { useMemo } from 'react';
import { createGradeColourScale, gradeToColour } from '../utils/colourScale';

interface GradeLegendProps {
  min: number;
  max: number;
}

const STEPS = 6;

export function GradeLegend({ min, max }: GradeLegendProps) {
  const stops = useMemo(() => {
    const scale = createGradeColourScale(min, max);
    const logMin = Math.log(Math.max(min, 0.1));
    const logMax = Math.log(max);
    return Array.from({ length: STEPS }, (_, i) => {
      const t = i / (STEPS - 1);
      const value = Math.exp(logMin + t * (logMax - logMin));
      return { value, colour: gradeToColour(scale, value) };
    });
  }, [min, max]);

  return (
    <div className="absolute bottom-4 left-4 rounded bg-black/80 p-3 text-[10px] text-text-primary backdrop-blur-sm">
      <div className="mb-1.5 font-medium text-text-secondary">Au (g/t)</div>
      <div className="flex">
        {stops.map((stop, i) => (
          <div
            key={i}
            data-testid="colour-stop"
            className="h-3 w-6"
            style={{ backgroundColor: stop.colour }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono">
        <span>{min.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}
