import { scaleSequentialLog } from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';
import { Color } from 'three';

export function createGradeColourScale(min: number, max: number) {
  return scaleSequentialLog(interpolateYlOrRd).domain([Math.max(min, 0.1), max]);
}

export function gradeToColour(
  scale: ReturnType<typeof createGradeColourScale>,
  grade: number,
): string {
  return scale(grade);
}

export function parseColourToRgb(colour: string): [number, number, number] {
  const match = colour.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return [1, 1, 1];
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

export function gradeToThreeColour(
  scale: ReturnType<typeof createGradeColourScale>,
  grade: number,
): Color {
  const [r, g, b] = parseColourToRgb(gradeToColour(scale, grade));
  return new Color(r, g, b);
}
