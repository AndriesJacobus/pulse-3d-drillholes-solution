import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoPanel } from './InfoPanel';
import { useStore } from '../store/useStore';
import type { Drillhole, Intercept } from '../types/drillhole';

const mineralised: Drillhole = {
  hole_code: 'CVEX005',
  prospect: 'Cheer',
  collar: { x: 0, y: 0, z: 0 },
  trace: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -100, z: 0 },
  ],
  total_depth: 120,
  dip: -60,
  azimuth: 20,
  latitude: -29.95,
  longitude: 121.17,
  collar_page: 5,
  intercepts: [
    {
      depth_from: 78,
      depth_to: 80,
      interval_m: 2,
      grade: 3.1,
      grade_unit: 'g/t',
      commodity: 'Au',
      start_pos: { x: 0, y: -78, z: 0 },
      end_pos: { x: 0, y: -80, z: 0 },
      page: 8,
    },
  ],
};

const barren: Drillhole = {
  ...mineralised,
  hole_code: 'CVEX010',
  intercepts: [],
  collar_page: null,
};

describe('InfoPanel', () => {
  beforeEach(() => {
    useStore.setState({
      selectedHole: null,
      selectedIntercept: null,
    });
  });

  test('shows prompt text when nothing selected', () => {
    render(<InfoPanel />);
    expect(screen.getByTestId('info-panel')).toHaveTextContent('Click a drillhole to inspect');
  });

  test('shows hole details when selected', () => {
    useStore.setState({ selectedHole: mineralised });
    render(<InfoPanel />);
    expect(screen.getByText('CVEX005')).toBeInTheDocument();
    expect(screen.getByText('Cheer')).toBeInTheDocument();
    expect(screen.getByText('-60°')).toBeInTheDocument();
    expect(screen.getByText('20°')).toBeInTheDocument();
    expect(screen.getByText('120m')).toBeInTheDocument();
  });

  test('shows intercept list for mineralised hole', () => {
    useStore.setState({ selectedHole: mineralised });
    render(<InfoPanel />);
    expect(screen.getByText('Intercepts (1)')).toBeInTheDocument();
    expect(screen.getByText(/3.1/)).toBeInTheDocument();
  });

  test('shows barren message for hole without intercepts', () => {
    useStore.setState({ selectedHole: barren });
    render(<InfoPanel />);
    expect(screen.getByText('No significant intercepts')).toBeInTheDocument();
  });

  test('highlights active intercept', () => {
    const intercept: Intercept = mineralised.intercepts[0];
    useStore.setState({ selectedHole: mineralised, selectedIntercept: intercept });
    render(<InfoPanel />);
    const li = screen.getByText(/78/).closest('li');
    expect(li?.className).toContain('bg-accent-muted');
  });

  test('shows source PDF button for intercept with page', () => {
    useStore.setState({ selectedHole: mineralised });
    render(<InfoPanel />);
    const button = screen.getByText('Source (p.8)');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  test('shows collar PDF button when available', () => {
    useStore.setState({ selectedHole: mineralised });
    render(<InfoPanel />);
    const button = screen.getByText('View source PDF (p.5)');
    expect(button.tagName).toBe('BUTTON');
  });
});
