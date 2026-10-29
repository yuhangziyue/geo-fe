import { expect, test } from '@playwright/test';

// Layout regression for the filter areas (2026-10-29 rework). The question list used to split filtering across
// two regions — a FilterBar crammed beside the page title (wrapping to two rows) and a separate form card — with
// two clear actions and a dead Range control (the response carried no reporting window). The home bar had 2px
// label misalignment, an orphan-wrapped Intent at ~768px and ~220px of dead space on wide rows.

interface Block {
  label: string;
  top: number;
  right: number;
}

async function filterBlocks(page: import('@playwright/test').Page): Promise<Block[]> {
  return page.evaluate(() => {
    const group = document.querySelector('[aria-label="Filters"]') as HTMLElement;
    return [...group.children].map((child) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      return {
        label: child.querySelector('span.text-xs')?.textContent?.trim() ?? '',
        top: Math.round(r.top * 10) / 10,
        right: Math.round(r.right * 10) / 10,
      };
    });
  });
}

test.describe('question list: one filter region', () => {
  test('global dimensions and list filters share one region below the header, with one clear action', async ({ page }) => {
    await page.goto('/dashboard/questions');
    const list = page.locator('section[aria-label="Question list"]');
    await expect(list).toBeVisible();

    const region = page.locator('section[aria-label="Question filters"]');
    await expect(region).toBeVisible();
    for (const name of ['Platform', 'Topic', 'Intent']) {
      await expect(region.getByRole('combobox', { name })).toBeVisible();
    }
    await expect(region.getByLabel('Mentioned')).toBeVisible();
    await expect(region.getByLabel('Recommended')).toBeVisible();
    await expect(region.getByLabel('Keyword')).toBeVisible();
    await expect(region.getByRole('button', { name: 'Search' })).toBeVisible();

    // The header sits above the region and outside it.
    const tops = await page.evaluate(() => ({
      h1: document.querySelector('h1')!.getBoundingClientRect().top,
      region: document.querySelector('section[aria-label="Question filters"]')!.getBoundingClientRect().top,
      insideH1: document.querySelector('h1')!.contains(document.querySelector('section[aria-label="Question filters"]')),
    }));
    expect(tops.insideH1).toBe(false);
    expect(tops.h1).toBeLessThan(tops.region);

    // FilterBar's own "Clear all" is hidden here; "Clear filters" is the single clear action.
    await expect(page.getByRole('button', { name: 'Clear all' })).toHaveCount(0);
  });

  test('range presets are anchored on the reporting window carried by the questions API', async ({ page }) => {
    await page.goto('/dashboard/questions');
    const list = page.locator('section[aria-label="Question list"]');
    await expect(list).toBeVisible();

    await expect(page.getByRole('button', { name: 'Week', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-08-24&to=2026-08-30$/);
    // The filter narrows the list (7 days × 4 questions = 28).
    await expect(list.getByText(/^28 questions$/)).toBeVisible();
  });
});

test.describe('filter bar alignment (home)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('labels share one baseline and the row fills the width', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();

    const blocks = await filterBlocks(page);
    expect(blocks.map((b) => b.label)).toEqual(['Range', 'Platform', 'Topic', 'Intent']);
    // All four label rows start within 1px (the segmented control used to sit 2px lower than the antd Selects).
    const tops = blocks.map((b) => b.top);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    // The row fills the container: the last control ends within 60px of the group's right edge.
    const groupRight = await page.evaluate(
      () => Math.round((document.querySelector('[aria-label="Filters"]') as HTMLElement).getBoundingClientRect().right),
    );
    expect(groupRight - blocks[blocks.length - 1].right).toBeLessThanOrEqual(60);
  });
});

test.describe('filter bar wrapping (home, 768px)', () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test('no control wraps alone onto a row', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();

    const blocks = await filterBlocks(page);
    expect(blocks.length).toBe(4);
    // Group into rows by top (±4px tolerance); every row must hold at least two controls.
    const rows: Block[][] = [];
    for (const b of blocks) {
      const row = rows.find((r) => Math.abs(r[0].top - b.top) <= 4);
      if (row) row.push(b);
      else rows.push([b]);
    }
    for (const row of rows) {
      expect(row.length, `row with only [${row.map((b) => b.label).join(', ')}]`).toBeGreaterThanOrEqual(2);
    }
  });
});
