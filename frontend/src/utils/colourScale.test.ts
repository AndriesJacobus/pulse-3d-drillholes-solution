import { describe, test, expect } from 'vitest';
import { createGradeColourScale, gradeToColour, parseColourToRgb } from './colourScale';

describe('createGradeColourScale', () => {
  const scale = createGradeColourScale(0.6, 10.8);

  test('minimum grade maps to cool end of ramp', () => {
    const colour = gradeToColour(scale, 0.6);
    const [r, g] = parseColourToRgb(colour);
    expect(g).toBeGreaterThan(r * 0.5);
  });

  test('maximum grade maps to hot end of ramp', () => {
    const colour = gradeToColour(scale, 10.8);
    const [r, g, b] = parseColourToRgb(colour);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  test('midpoint produces distinct colour from min and max', () => {
    const low = gradeToColour(scale, 0.6);
    const mid = gradeToColour(scale, 3.0);
    const high = gradeToColour(scale, 10.8);
    expect(mid).not.toBe(low);
    expect(mid).not.toBe(high);
  });

  test('log scale differentiates low-end grades', () => {
    const c06 = gradeToColour(scale, 0.6);
    const c10 = gradeToColour(scale, 1.0);
    const c20 = gradeToColour(scale, 2.0);
    expect(c06).not.toBe(c10);
    expect(c10).not.toBe(c20);
  });

  test('values below domain minimum still return a colour', () => {
    const colour = gradeToColour(scale, 0.1);
    expect(colour).toBeDefined();
    expect(colour.length).toBeGreaterThan(0);
  });
});

describe('parseColourToRgb', () => {
  test('parses rgb string to normalised 0-1 values', () => {
    const [r, g, b] = parseColourToRgb('rgb(255, 128, 0)');
    expect(r).toBeCloseTo(1.0, 1);
    expect(g).toBeCloseTo(0.5, 1);
    expect(b).toBeCloseTo(0.0, 1);
  });

  test('returns white for unparseable strings', () => {
    const [r, g, b] = parseColourToRgb('invalid');
    expect(r).toBe(1);
    expect(g).toBe(1);
    expect(b).toBe(1);
  });

  test('handles zero values', () => {
    const [r, g, b] = parseColourToRgb('rgb(0, 0, 0)');
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});
