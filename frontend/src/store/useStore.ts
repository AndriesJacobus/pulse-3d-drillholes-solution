import { create } from 'zustand';
import type { Vector3 } from 'three';
import type { Drillhole, Intercept } from '../types/drillhole';

interface FocusTarget {
  position: Vector3;
  radius: number;
  onArrive?: () => void;
}

interface AppState {
  selectedHole: Drillhole | null;
  selectedIntercept: Intercept | null;
  showGradeCloud: boolean;
  showMap: boolean;
  pdfPage: number | null;
  focusTarget: FocusTarget | null;
  setSelectedHole: (hole: Drillhole | null) => void;
  setSelectedIntercept: (intercept: Intercept | null) => void;
  setShowGradeCloud: (show: boolean) => void;
  setShowMap: (show: boolean) => void;
  setPdfPage: (page: number | null) => void;
  setFocusTarget: (target: FocusTarget | null) => void;
}

export const useStore = create<AppState>((set) => ({
  selectedHole: null,
  selectedIntercept: null,
  showGradeCloud: false,
  showMap: true,
  pdfPage: null,
  focusTarget: null,
  setSelectedHole: (hole) =>
    set((state) => ({
      selectedHole: hole,
      selectedIntercept: null,
      pdfPage: hole ? state.pdfPage : null,
    })),
  setSelectedIntercept: (intercept) => set({ selectedIntercept: intercept }),
  setShowGradeCloud: (show) => set({ showGradeCloud: show }),
  setShowMap: (show) => set({ showMap: show }),
  setPdfPage: (page) => set({ pdfPage: page }),
  setFocusTarget: (target) => set({ focusTarget: target }),
}));
