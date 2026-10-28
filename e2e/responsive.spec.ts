import { expect, test } from '@playwright/test';

// Responsive regression: the page must never scroll horizontally. At 375px the dashboard nav and the
// product grid/table used to push the document wider than the viewport; the specs table scrolls
// inside its own overflow container instead.
async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test.describe('responsive 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of ['/dashboard', '/dashboard/questions', '/products/nova-x4']) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      // Data is fetched client-side; wait for it so the real layout is measured.
      if (path === '/dashboard') {
        await expect(page.getByText('questions asked').first()).toBeVisible();
      } else if (path === '/dashboard/questions') {
        const list = page.locator('section[aria-label="Question list"]');
        await expect(list).toBeVisible();
        await expect(list.locator('li').first()).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: 'Nova X4' })).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('responsive 1024px', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('/products/nova-x4 has no horizontal overflow', async ({ page }) => {
    await page.goto('/products/nova-x4', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Nova X4' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
