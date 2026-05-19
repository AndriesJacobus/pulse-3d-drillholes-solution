import { create } from 'zustand';
import type { Drillhole, Intercept } from '../types/drillhole';

interface AppState {
  selectedHole: Drillhole | null;
  selectedIntercept: Intercept | null;
  setSelectedHole: (hole: Drillhole | null) => void;
  setSelectedIntercept: (intercept: Intercept | null) => void;
}

export const useStore = create<AppState>((set) => ({
  selectedHole: null,
  selectedIntercept: null,
  setSelectedHole: (hole) => set({ selectedHole: hole, selectedIntercept: null }),
  setSelectedIntercept: (intercept) => set({ selectedIntercept: intercept }),
}));
