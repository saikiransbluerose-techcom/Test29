// utils/ui.js
import { expect } from '@playwright/test';

/** Scroll to a locator, ensure it's visible, briefly outline it, then restore. */
export async function expectVisibleAndHighlight(
  page,
  locator,
  { timeout = 10_000, outline = '3px solid #FFD400', ms = 600 } = {}
) {
  await expect(locator).toBeVisible({ timeout });
  await locator.scrollIntoViewIfNeeded();

  // set outline, wait, restore previous outline
  await locator.evaluate((el, { outline }) => {
    el.dataset.__oldOutline = el.style.outline || '';
    el.style.outline = outline;
  }, { outline });

  await page.waitForTimeout(ms);

  await locator.evaluate(el => {
    el.style.outline = el.dataset.__oldOutline || '';
    delete el.dataset.__oldOutline;
  });
}
