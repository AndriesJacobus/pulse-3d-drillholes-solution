import { test, expect } from '@playwright/test';

test.describe('Drillhole Viewer', () => {
  test('page loads and renders the 3D scene', async ({ page }) => {
    await page.goto('/');

    const scene = page.getByTestId('scene');
    await expect(scene).toBeVisible({ timeout: 15_000 });

    const canvas = scene.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('clicking a collar label opens the info panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('scene')).toBeVisible({ timeout: 15_000 });

    // Labels are HTML overlays in a 3D scene; they move with the camera
    // and overlap each other, so force the click to bypass stability checks
    const label = page.getByTestId('collar-label').first();
    await label.click({ force: true });

    const infoPanel = page.getByTestId('info-panel');
    await expect(infoPanel).toBeVisible({ timeout: 5_000 });
  });

  test('API health endpoint responds through the proxy', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('drillholes endpoint returns 31 holes', async ({ request }) => {
    const response = await request.get('/api/drillholes');
    expect(response.ok()).toBe(true);

    const holes = await response.json();
    expect(holes).toHaveLength(31);
  });
});
