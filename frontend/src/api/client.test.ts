import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fetchDrillholes, fetchMetadata, getSourcePdfUrl } from './client';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchDrillholes', () => {
  test('returns typed array on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ hole_code: 'CVEX005', trace: [], intercepts: [] }]),
    } as Response);

    const result = await fetchDrillholes();
    expect(result).toHaveLength(1);
    expect(result[0].hole_code).toBe('CVEX005');
  });

  test('throws on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchDrillholes()).rejects.toThrow('500');
  });

  test('throws on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(fetchDrillholes()).rejects.toThrow('Network error');
  });
});

describe('fetchMetadata', () => {
  test('returns metadata on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          project_name: 'Comet Vale Gold Project',
          total_holes: 31,
          total_intercepts: 14,
        }),
    } as Response);

    const result = await fetchMetadata();
    expect(result.project_name).toBe('Comet Vale Gold Project');
    expect(result.total_holes).toBe(31);
  });

  test('throws on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchMetadata()).rejects.toThrow('404');
  });
});

describe('getSourcePdfUrl', () => {
  test('returns base URL without page', () => {
    expect(getSourcePdfUrl()).toBe('/api/source-pdf');
  });

  test('appends page anchor', () => {
    expect(getSourcePdfUrl(8)).toBe('/api/source-pdf#page=8');
  });
});
