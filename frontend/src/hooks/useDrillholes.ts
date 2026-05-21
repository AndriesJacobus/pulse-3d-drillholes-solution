import { useQuery } from '@tanstack/react-query';
import { fetchClusters, fetchDrillholes, fetchGradeEstimation, fetchMetadata } from '../api/client';

export function useDrillholes() {
  return useQuery({
    queryKey: ['drillholes'],
    queryFn: fetchDrillholes,
  });
}

export function useMetadata() {
  return useQuery({
    queryKey: ['metadata'],
    queryFn: fetchMetadata,
  });
}

export function useGradeEstimation() {
  return useQuery({
    queryKey: ['gradeEstimation'],
    queryFn: fetchGradeEstimation,
  });
}

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: fetchClusters,
  });
}
