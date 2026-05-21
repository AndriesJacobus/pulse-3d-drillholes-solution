import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GradeLegend } from './GradeLegend';

describe('GradeLegend', () => {
  test('renders min and max labels', () => {
    render(<GradeLegend min={0.6} max={10.8} />);
    expect(screen.getByText('0.6')).toBeInTheDocument();
    expect(screen.getByText('10.8')).toBeInTheDocument();
  });

  test('renders correct number of colour stops', () => {
    render(<GradeLegend min={0.6} max={10.8} />);
    const stops = screen.getAllByTestId('colour-stop');
    expect(stops).toHaveLength(6);
  });

  test('displays commodity unit label', () => {
    render(<GradeLegend min={0.6} max={10.8} />);
    expect(screen.getByText('Au (g/t)')).toBeInTheDocument();
  });

  test('colour stops have background colours set', () => {
    render(<GradeLegend min={0.6} max={10.8} />);
    const stops = screen.getAllByTestId('colour-stop');
    for (const stop of stops) {
      expect(stop.style.backgroundColor).not.toBe('');
    }
  });
});
