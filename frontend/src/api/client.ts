import type { Drillhole, Metadata } from '../types/drillhole';

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

export function getSourcePdfUrl(page?: number): string {
  const base = `${API_BASE}/source-pdf`;
  return page ? `${base}#page=${page}` : base;
}
