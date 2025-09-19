// utils/simpleForm.js
import { expect } from '@playwright/test';

export class SimpleForm {
  constructor(page) {
    this.page = page;
  }

  // --- Core wait+select (kept very explicit & readable) ---
  async #waitForOptionThenSelect(select, wantedValue, timeoutMs = 30_000) {
    //  Control visible & enabled
    await expect(select).toBeVisible({ timeout: timeoutMs });
    await expect(select).toBeEnabled({ timeout: timeoutMs });
    await select.scrollIntoViewIfNeeded();

    // Wait until the desired option VALUE exists (PEGA often populates a bit later)
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const values = await select
        .locator('option')
        .evaluateAll(opts => opts.map(o => (o.value || '').trim()));
      if (values.includes(wantedValue)) break;
      await this.page.waitForTimeout(250);
    }

    // Select by VALUE (more robust than label)
    await select.selectOption({ value: wantedValue });

    // Verify selection; if a re-render interrupted it, try once more
    try {
      await expect(select).toHaveValue(wantedValue, { timeout: 5_000 });
    } catch {
      // reselect once (works if element stayed attached)
      await select.selectOption({ value: wantedValue });
      await expect(select).toHaveValue(wantedValue, { timeout: 5_000 });
    }
  }

  // --- Public, simple entrypoints ---

  /** Select by exact name="...". */
  async selectByName(root, name, value) {
    const select = root.locator(`select[name="${name}"]`).first();
    await this.#waitForOptionThenSelect(select, value);
  }

  /** Select by name suffix (e.g., inside rows where index in name is dynamic). */
  async selectByNameSuffix(root, nameEndsWith, value) {
    const select = root.locator(`select[name$="${nameEndsWith}"]`).first();
    await this.#waitForOptionThenSelect(select, value);
  }

  /** Fill an input by exact name="...". */
  async fillByName(root, name, text) {
    const input = root.locator(`input[name="${name}"]`).first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await expect(input).toBeEditable({ timeout: 30_000 });
    await input.fill(text);
  }

  /** Fill an input by name suffix (handy in Stage-1 rows). */
  async fillByNameSuffix(root, nameEndsWith, text) {
    const input = root.locator(`input[name$="${nameEndsWith}"]`).first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await expect(input).toBeEditable({ timeout: 30_000 });
    await input.fill(text);
  }

  /** Convenience: get the first table row containing the given text (e.g., "Production"). */
  row(root, text) {
    return root.locator('table').locator(`tr:has-text("${text}")`).first();
  }
}
