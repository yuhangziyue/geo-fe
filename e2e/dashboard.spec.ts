import { expect, test } from '@playwright/test';

// FilterBar labels each antd Select with aria-label, so the accessible name is exactly "Platform" / "Topic" / "Intent".
const select = (page: import('@playwright/test').Page, name: string) => page.getByRole('combobox', { name });
// The antd Select content node, whose title reflects the chosen value.
const selectBox = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.ant-select').filter({ has: page.getByRole('combobox', { name }) }).locator('.ant-select-content');
// antd Select keyboard pick: searchable selects narrow with typing first, then ArrowDown + Enter confirm.
async function pick(page: import('@playwright/test').Page, name: string, value: string, searchable: boolean) {
  const combobox = select(page, name);
  await combobox.click();
  if (searchable) {
    await combobox.fill(value);
    await page.waitForTimeout(300); // antd filters the option list as you type
  }
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

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

    // The action center lives on the AI Insights tab; its own empty state still shows there.
    await page.goto('/dashboard?tab=insights&simulate=empty');
    await expect(page.getByText('No issues crossed a threshold for this selection.').first()).toBeVisible();
  });

  test('each chart exposes its numbers as a table', async ({ page }) => {
    await page.goto('/dashboard');
    const topicCard = page.locator('section', { has: page.getByRole('heading', { name: 'Visibility by topic' }) });
    await topicCard.getByRole('button', { name: 'Table' }).click();
    const table = topicCard.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(9); // header + 8 topics
    await expect(table.getByRole('row', { name: /Office Security/ })).toContainText('53%');
  });

  test('view tabs live in the URL and switch between Data and AI Insights', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();
    await expect(page.getByText('Action Center')).toHaveCount(0);

    // Layout: title row, then the view tabs, then the filter row.
    const tops = await page.evaluate(() => {
      const y = (s: string) => document.querySelector(s)?.getBoundingClientRect().top ?? -1;
      return { title: y('h1'), tabs: y('[aria-label="Report view"]'), filters: y('[aria-label="Filters"]') };
    });
    expect(tops.title).toBeLessThanOrEqual(tops.tabs);
    expect(tops.tabs).toBeLessThanOrEqual(tops.filters);

    await page.getByRole('tab', { name: 'AI Insights' }).click();
    await expect(page).toHaveURL(/\/dashboard\?tab=insights$/);
    await expect(page.getByText('Action Center').first()).toBeVisible();
    await expect(page.getByText('questions asked')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('questions asked').first()).toBeVisible();
  });

  test('quick range presets bound the reporting window and live in the URL', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();
    const funnel = page.locator('section', { hasText: 'questions asked' });

    // Quarter is greyed out: the dataset covers 30 days.
    await expect(page.getByRole('button', { name: 'Quarter' })).toBeDisabled();

    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-08-24&to=2026-08-30$/);
    await expect(page.getByText('Aug 24 – Aug 30').first()).toBeVisible();
    await expect(funnel).toContainText('28', { timeout: 10_000 }); // 7 days × 4 questions

    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-08-30&to=2026-08-30$/);
    await expect(funnel).toContainText('4', { timeout: 10_000 });

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(funnel).toContainText('120', { timeout: 10_000 });
  });

  test('custom date range bounds the window and lives in the URL', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();

    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Custom date range' });
    await expect(dialog).toBeVisible();
    const rangeInputs = dialog.locator('.ant-picker input');
    await expect(rangeInputs.nth(0)).toBeVisible();
    // A valid pair applies immediately (modeless popover) and closes itself.
    await rangeInputs.nth(0).fill('2026-08-10');
    await rangeInputs.nth(1).fill('2026-08-20');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/from=2026-08-10&to=2026-08-20$/);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Aug 10 – Aug 20').first()).toBeVisible();
    const funnel = page.locator('section', { hasText: 'questions asked' });
    await expect(funnel).toContainText('44', { timeout: 10_000 }); // 11 days × 4 questions
    // The active preset is Custom and its trigger shows the chosen window.
    await expect(page.getByRole('button', { name: 'Aug 10 – Aug 20' })).toHaveAttribute('aria-pressed', 'true');

    // Reopening backfills the chosen window, and the picker's clear button reverts to All.
    await page.getByRole('button', { name: 'Aug 10 – Aug 20' }).click();
    await expect(rangeInputs.nth(0)).toHaveValue('2026-08-10');
    await expect(rangeInputs.nth(1)).toHaveValue('2026-08-20');
    await dialog.locator('.ant-picker').hover();
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('attribution view ranks halves and drills into the question list', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();
    const trend = page.locator('section', { has: page.getByRole('heading', { name: 'Visibility trend' }) });

    await trend.getByRole('tab', { name: 'Attribution' }).click();
    const table = trend.getByRole('table').first();
    await expect(table.getByRole('row')).toHaveCount(6); // header + 5 platforms
    await expect(table.getByRole('columnheader', { name: 'First half n·rate' })).toBeVisible();
    await expect(table.getByRole('row', { name: /DeepSeek/ })).toContainText('View questions');

    // Every ranking row offers a "View questions" drill-down carrying the dimension value.
    const firstLink = trend.getByRole('link', { name: 'View questions' }).first();
    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/\/dashboard\/questions\?platform=/);
    const platform = decodeURIComponent(new URL(href!, page.url()).searchParams.get('platform')!);
    await firstLink.click();
    await expect(page).toHaveURL(/\/dashboard\/questions\?platform=/);
    await expect(selectBox(page, 'Platform')).toHaveAttribute('title', platform);

    // Intent tab: A/C lines plus the "too few samples" footnote for B/S.
    await page.goBack();
    await expect(page.getByText('questions asked').first()).toBeVisible();
    const trend2 = page.locator('section', { has: page.getByRole('heading', { name: 'Visibility trend' }) });
    await trend2.getByRole('tab', { name: 'Attribution' }).click();
    await trend2.getByRole('tab', { name: 'Intent', exact: true }).click();
    await expect(trend2.getByText('have too few samples').first()).toBeVisible();
  });

  test('filters live in the URL and survive drill-down and Back', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible(); // wait for facets + data

    await pick(page, 'Platform', 'DeepSeek', true);
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek$/);
    await pick(page, 'Topic', 'Retail Analytics', true);
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics$/);
    await pick(page, 'Intent', 'A', false);
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);

    // Drill-down keeps all three dimensions and adds the question list.
    await page.getByRole('link', { name: /^Asked/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/questions\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);
    await expect(selectBox(page, 'Platform')).toHaveAttribute('title', 'DeepSeek');
    await expect(selectBox(page, 'Topic')).toHaveAttribute('title', 'Retail Analytics');
    await expect(selectBox(page, 'Intent')).toHaveAttribute('title', /^A /);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\?platform=DeepSeek&topic=Retail\+Analytics&intent=A$/);
    await expect(selectBox(page, 'Topic')).toHaveAttribute('title', 'Retail Analytics');
  });

  test('P1 signal console: dark Overall card with cutoff stamp, then 14-day platform small multiples', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('questions asked').first()).toBeVisible();
    const trend = page.locator('section', { has: page.getByRole('heading', { name: 'Visibility trend' }) });
    const card = trend.locator('.ant-card').first();

    // Overall pane = dark signal console (#0F172A) with the static "● LIVE · as of Aug 30" cutoff stamp.
    await expect(card).toHaveCSS('background-color', 'rgb(15, 23, 42)');
    const stamp = trend.locator('[title*="nightly snapshot"]').first();
    await expect(stamp).toBeVisible();
    await expect(stamp).toContainText('LIVE');
    await expect(stamp).toContainText('as of Aug 30');
    // The stamp explains itself: static snapshot, not a live feed.
    expect(await stamp.getAttribute('title')).toMatch(/static cutoff marker/i);

    // View separation: Attribution is the light analytical surface — stamp and console are gone.
    await trend.getByRole('tab', { name: 'Attribution' }).click();
    await expect(trend.getByText(/LIVE/)).toHaveCount(0);
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Platform pane: five 14-day small multiples (never a sixth), each with a window-n badge (window n, not 24).
    const minis = trend.getByRole('img', { name: /^14-day rolling visibility for / });
    await expect(minis).toHaveCount(5);
    const badges = trend.getByText(/^n=\d+$/);
    await expect(badges.first()).toBeVisible();
    const badgeTexts = await badges.allTextContents();
    expect(badgeTexts.every((t) => Number(t.slice(2)) < 24)).toBeTruthy();

    // Tooltip states the window row count verbatim: "14-day: 11 rows".
    const deepseek = trend.getByRole('img', { name: '14-day rolling visibility for DeepSeek' });
    await deepseek.hover({ position: { x: 120, y: 30 } });
    await expect(page.locator('body')).toContainText(/14-day: \d+ rows/);

    // Cyan signal and teal intent never share an axis: the console chart only exists on the Overall tab.
    await trend.getByRole('tab', { name: 'Intent', exact: true }).click();
    await expect(minis).toHaveCount(0);
    await expect(trend.getByRole('img', { name: '7-day rolling visibility with daily values' })).toHaveCount(0);
    await expect(trend.getByRole('img', { name: '7-day rolling visibility for intent A and C' })).toBeVisible();
  });

  test('Generate summary always works without a key', async ({ page }) => {
    await page.goto('/dashboard?tab=insights');
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
