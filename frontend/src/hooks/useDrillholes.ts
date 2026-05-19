import { useQuery } from '@tanstack/react-query';
import { fetchDrillholes, fetchMetadata } from '../api/client';

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
