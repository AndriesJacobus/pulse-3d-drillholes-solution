import type { Cluster, Drillhole, GradeEstimation, Metadata } from '../types/drillhole';

const API_BASE = '/api';

export async function fetchDrillholes(): Promise<Drillhole[]> {
  const res = await fetch(`${API_BASE}/drillholes`);
  if (!res.ok) throw new Error(`Failed to fetch drillholes: ${res.status}`);
  return res.json();
}

export async function fetchMetadata(): Promise<Metadata> {
  const res = await fetch(`${API_BASE}/metadata`);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}

export async function fetchGradeEstimation(): Promise<GradeEstimation> {
  const res = await fetch(`${API_BASE}/grade-estimation`);
  if (!res.ok) throw new Error(`Failed to fetch grade estimation: ${res.status}`);
  return res.json();
}

export async function fetchClusters(): Promise<Cluster[]> {
  const res = await fetch(`${API_BASE}/clusters`);
  if (!res.ok) throw new Error(`Failed to fetch clusters: ${res.status}`);
  return res.json();
}

export function getSourcePdfUrl(page?: number): string {
  const base = `${API_BASE}/source-pdf`;
  return page ? `${base}#page=${page}` : base;
}
