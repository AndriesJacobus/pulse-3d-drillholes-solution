import { describe, test, expect, beforeEach } from 'vitest';
import { useStore } from './useStore';
import type { Drillhole, Intercept } from '../types/drillhole';

const mockHole: Drillhole = {
  hole_code: 'CVEX005',
  prospect: 'Cheer',
  collar: { x: 0, y: 0, z: 0 },
  trace: [],
  total_depth: 120,
  dip: -60,
  azimuth: 20,
  latitude: -31.5,
  longitude: 121.5,
  collar_page: null,
  intercepts: [],
};

const mockIntercept: Intercept = {
  depth_from: 78,
  depth_to: 80,
  interval_m: 2,
  grade: 3.1,
  grade_unit: 'g/t',
  commodity: 'Au',
  start_pos: { x: 0, y: 0, z: 0 },
  end_pos: { x: 0, y: -2, z: 0 },
  page: 8,
};

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({ selectedHole: null, selectedIntercept: null, showGradeCloud: false });
  });

  test('initial state has nothing selected', () => {
    const state = useStore.getState();
    expect(state.selectedHole).toBeNull();
    expect(state.selectedIntercept).toBeNull();
  });

  test('setSelectedHole updates state', () => {
    useStore.getState().setSelectedHole(mockHole);
    expect(useStore.getState().selectedHole).toBe(mockHole);
  });

  test('setSelectedHole clears intercept', () => {
    useStore.getState().setSelectedIntercept(mockIntercept);
    useStore.getState().setSelectedHole(mockHole);
    expect(useStore.getState().selectedIntercept).toBeNull();
  });

  test('setSelectedIntercept updates state', () => {
    useStore.getState().setSelectedIntercept(mockIntercept);
    expect(useStore.getState().selectedIntercept).toBe(mockIntercept);
  });

  test('clearing hole sets both to null', () => {
    useStore.getState().setSelectedHole(mockHole);
    useStore.getState().setSelectedIntercept(mockIntercept);
    useStore.getState().setSelectedHole(null);
    expect(useStore.getState().selectedHole).toBeNull();
    expect(useStore.getState().selectedIntercept).toBeNull();
  });

  test('selecting a hole does not change pdfPage', () => {
    useStore.setState({ pdfPage: 5 });
    useStore.getState().setSelectedHole(mockHole);
    expect(useStore.getState().pdfPage).toBe(5);
  });

  test('selecting a hole preserves null pdfPage', () => {
    useStore.setState({ pdfPage: null });
    useStore.getState().setSelectedHole(mockHole);
    expect(useStore.getState().pdfPage).toBeNull();
  });

  test('deselecting a hole closes the PDF', () => {
    useStore.setState({ pdfPage: 5 });
    useStore.getState().setSelectedHole(null);
    expect(useStore.getState().pdfPage).toBeNull();
  });

  test('showGradeCloud defaults to false', () => {
    expect(useStore.getState().showGradeCloud).toBe(false);
  });

  test('setShowGradeCloud toggles state', () => {
    useStore.getState().setShowGradeCloud(true);
    expect(useStore.getState().showGradeCloud).toBe(true);
    useStore.getState().setShowGradeCloud(false);
    expect(useStore.getState().showGradeCloud).toBe(false);
  });
});
