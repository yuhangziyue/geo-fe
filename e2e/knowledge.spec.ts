import { expect, test } from '@playwright/test';

test('an admin save regenerates the static product page and its JSON-LD', async ({ page }) => {
  const feature = `E2E feature ${Date.now()}`;

  await page.goto('/admin/products/nova-x4/edit');
  const features = page.getByLabel('Key features');
  await features.fill(`${await features.inputValue()}\n${feature}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved. Product page and JSON-LD regenerated.')).toBeVisible();

  // Statically generated page: the save must reach the HTML that crawlers and AI engines read.
  await expect(async () => {
    await page.goto('/products/nova-x4');
    await expect(page.getByText(feature)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(ld).toContain(feature);
  expect(ld).toContain('"dateModified"');
  await expect(page.getByText('Last updated')).toBeVisible();
});

test('a scenario with no products stays out of the index', async ({ page, request }) => {
  await page.goto('/scenarios/multi-site');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/scenarios/multi-site');
});

test('a failed save tells the user and does not leave the form stuck', async ({ page }) => {
  await page.goto('/admin/products/nova-x8/edit');
  await page.route('**/api/knowledge/products/**', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Network error: the change was not saved/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});
