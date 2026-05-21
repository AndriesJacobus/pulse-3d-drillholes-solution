import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './Header';

vi.mock('../api/client', () => ({
  fetchMetadata: () =>
    Promise.resolve({
      project_name: 'Test Gold Project',
      prospects: ['Alpha', 'Beta'],
      total_holes: 31,
      total_intercepts: 14,
      grade_range: { min: 0.6, max: 10.8 },
      centroid: { east: 0, north: 0, rl: 0 },
      commodities: ['Au'],
    }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Header', () => {
  test('shows project name from metadata', async () => {
    renderWithQuery(<Header />);
    expect(await screen.findByText('Test Gold Project')).toBeInTheDocument();
  });

  test('shows hole and intercept counts', async () => {
    renderWithQuery(<Header />);
    const stats = await screen.findByText(/31 holes/);
    expect(stats).toBeInTheDocument();
    expect(stats).toHaveTextContent('14 intercepts');
  });

  test('shows fallback title before data loads', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, enabled: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Drillhole Viewer')).toBeInTheDocument();
  });
});
