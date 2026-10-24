import { expect, test } from '@playwright/test';

// A <label> wrapping a <select> names it "Platform <selected option>", hence the prefix match.
const select = (page: import('@playwright/test').Page, name: string) => page.getByRole('combobox', { name: new RegExp(`^${name}`) });

test.describe('dashboard', () => {
  test('every data block handles Loading, Error and Empty', async ({ page }) => {
    await page.goto('/dashboard?simulate=slow');
    await expect(page.getByRole('status', { name: 'Loading' }).first()).toBeVisible();
    await expect(page.getByText('9/32')).toBeVisible({ timeout: 10_000 }); // prompt coverage, once loaded

    await page.goto('/dashboard?simulate=error');
    await expect(page.getByRole('alert').first()).toContainText("Couldn't load this section");
    await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();

    await page.goto('/dashboard?simulate=empty');
    await expect(page.getByText('No questions were analyzed for this selection.')).toBeVisible();
  });

  test('each chart exposes its numbers as a table', async ({ page }) => {
    await page.goto('/dashboard');
    const topicCard = page.locator('section', { has: page.getByRole('heading', { name: 'Visibility by topic' }) });
    await topicCard.getByText('Show data table').click();
    const table = topicCard.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(9); // header + 8 topics
    await expect(table.getByRole('row', { name: /Office Security/ })).toContainText('53%');
  });

  test('filters live in the URL and survive drill-down and Back', async ({ page }) => {
    await page.goto('/dashboard');
    await select(page, 'Platform').selectOption('DeepSeek');
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek$/);
    await expect(page.getByText('11 of 24 questions mention the brand')).toBeVisible(); // DeepSeek: 46%

    // Drill-down keeps the platform and adds the clicked dimension.
    await page.getByRole('link', { name: /^Intent A/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/questions\?platform=DeepSeek&intent=A$/);
    await expect(select(page, 'Platform')).toHaveValue('DeepSeek');
    await expect(select(page, 'Intent')).toHaveValue('A');

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek$/);
    await expect(select(page, 'Platform')).toHaveValue('DeepSeek');
  });
});
