import { expect, test } from '@playwright/test';

// FilterBar labels each select with its own <label>, so the accessible name is exactly "Platform" / "Topic" / "Intent".
const select = (page: import('@playwright/test').Page, name: string) => page.getByRole('combobox', { name });

test.describe('dashboard', () => {
  test('every data block handles Loading, Error and Empty', async ({ page }) => {
    await page.goto('/dashboard?simulate=slow');
    await expect(page.getByRole('status', { name: 'Loading' }).first()).toBeVisible();
    // Funnel KPI band once loaded: 120 asked → 85 mentioned (71%) → 56 recommended.
    const funnel = page.locator('section', { hasText: 'questions asked' });
    await expect(funnel).toContainText('120', { timeout: 10_000 });
    await expect(funnel).toContainText('71% of asked');

    await page.goto('/dashboard?simulate=error');
    await expect(page.getByRole('alert').first()).toContainText("Couldn't load this section");
    await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();

    await page.goto('/dashboard?simulate=empty');
    await expect(page.getByText('No questions match these filters.').first()).toBeVisible();
    await expect(page.getByText('No issues crossed a threshold for this selection.').first()).toBeVisible();
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
    await expect(page.getByText('questions asked').first()).toBeVisible(); // wait for facets + data

    await select(page, 'Platform').selectOption('DeepSeek');
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek$/);
    await select(page, 'Topic').selectOption('Retail Analytics');
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics$/);
    await select(page, 'Intent').selectOption('A');
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);

    // Drill-down keeps all three dimensions and adds the question list.
    await page.getByRole('link', { name: /^Asked/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/questions\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);
    await expect(select(page, 'Platform')).toHaveValue('DeepSeek');
    await expect(select(page, 'Topic')).toHaveValue('Retail Analytics');
    await expect(select(page, 'Intent')).toHaveValue('A');

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);
    await expect(select(page, 'Topic')).toHaveValue('Retail Analytics');
  });

  test('Generate summary always works without a key', async ({ page }) => {
    await page.goto('/dashboard');
    const actionCenter = page.locator('section', { hasText: 'Action Center' });
    await expect(actionCenter).toContainText('Generate summary');
    await actionCenter.getByRole('button', { name: 'Generate summary' }).click();
    // No API key: the backend falls back to the deterministic rule-based summary (mode 'rules').
    await expect(actionCenter).toContainText('tracked questions', { timeout: 10_000 });
    await expect(actionCenter).toContainText('Owned sources account for');
    await expect(actionCenter.getByRole('button', { name: 'Regenerate summary' })).toBeVisible();
    await expect(actionCenter.getByText('Rules').first()).toBeVisible();
  });
});
