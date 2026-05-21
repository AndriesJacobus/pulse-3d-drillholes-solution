import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillholeTrace } from './DrillholeTrace';
import { useStore } from '../store/useStore';
import { createGradeColourScale } from '../utils/colourScale';
import type { Drillhole } from '../types/drillhole';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Line: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./InterceptSegment', () => ({
  InterceptSegment: () => null,
}));

const mockHole: Drillhole = {
  hole_code: 'CVEX005',
  prospect: 'Cheer',
  collar: { x: 10, y: 20, z: 30 },
  trace: [
    { x: 10, y: 20, z: 30 },
    { x: 10, y: -80, z: 30 },
  ],
  total_depth: 100,
  dip: -60,
  azimuth: 20,
  latitude: -31.5,
  longitude: 121.5,
  collar_page: 5,
  intercepts: [],
};

const colourScale = createGradeColourScale(0, 10);

describe('DrillholeTrace interaction', () => {
  beforeEach(() => {
    useStore.setState({
      selectedHole: null,
      selectedIntercept: null,
      pdfPage: null,
    });
  });

  test('clicking the label sets selectedHole in the store', async () => {
    const user = userEvent.setup();

    render(<DrillholeTrace hole={mockHole} colourScale={colourScale} />);

    const label = screen.getByText('CVEX005');
    await user.click(label);

    expect(useStore.getState().selectedHole).toBe(mockHole);
  });

  test('selected hole is visually distinguished', () => {
    useStore.setState({ selectedHole: mockHole });

    render(<DrillholeTrace hole={mockHole} colourScale={colourScale} />);

    const label = screen.getByText('CVEX005');
    expect(label.className).toContain('bg-accent');
  });

  test('clicking label clears previous intercept selection', async () => {
    const user = userEvent.setup();
    useStore.setState({
      selectedIntercept: {
        depth_from: 50,
        depth_to: 52,
        interval_m: 2,
        grade: 3.1,
        grade_unit: 'g/t',
        commodity: 'Au',
        start_pos: { x: 0, y: 0, z: 0 },
        end_pos: { x: 0, y: -2, z: 0 },
        page: 8,
      },
    });

    render(<DrillholeTrace hole={mockHole} colourScale={colourScale} />);

    await user.click(screen.getByText('CVEX005'));

    expect(useStore.getState().selectedHole).toBe(mockHole);
    expect(useStore.getState().selectedIntercept).toBeNull();
  });
});
