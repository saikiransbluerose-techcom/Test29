// pages/stages-roles.page.js
import { expect, test } from '@playwright/test';
import { Gadgets } from './gadgets.page.js';
import { expectVisibleAndHighlight } from '../utils/ui.js'; // ⬅️ add this import

export class StagesRolesPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {1|2} - Flow number
   */
  constructor(page, which) {
    this.page = page;
    this.which = which;
    this.g = new Gadgets(page);

    // Map of row ids for each flow
    this.map = {
      1: {
        // Flow 1 (When root case is known)
        row1: '201909111935010721260-R1-L1R1',
        row2_l1: '201909111935010721260-R2-L1R1',
        row2_l2: '201909111935010721260-R2-L1R2',
        openDir: '20151130155332032025152', // directory button inside row
        next: '20150908171228012736690', // "Next" button
      },
      2: {
        // Flow 2 (when root cause is not known)
        row1: '201909111935010721260-R2-L1R1',
        row2_l1: '201909111935010721260-R3-L1R1',
        row2_l2: '201909111935010721260-R3-L1R2',
        openDir: '20151130155332032025152',
        next: '20150908171228012736690',
      }
    };
  }

  // Always use gadget1 
  _gadget() {
    return this.g.frames().gadget1;
  }

  // Assign into a single row
  async _assignRow(rowTestId, assignee) {
    const g = this._gadget();
    const row = g.getByTestId(rowTestId);
    await expect(row, `Row ${rowTestId} should be visible`).toBeVisible();

    // Open directory → open search → type → click result
    await row.getByTestId(this.map[this.which].openDir).click();

    // Wait for the icon to be visible
    const icon = row.locator('i').nth(1);
    await expect(icon).toBeVisible({ timeout: 30000 });
    await icon.click();

    // Wait for the search box to be visible and editable
    const input = g.getByRole('textbox', { name: /.*lastname.*firstname.*,?/i });

    await expect(input).toBeEditable({ timeout: 30000 });

    // Fill the search input with assignee's search text
    await input.fill(assignee.searchText);

   
    // Wait for the display text to be visible in the results and select the correct user
    const emailOption = g.getByText(assignee.displayText);
    await expect(emailOption).toBeVisible({ timeout: 20000 }); // Ensure the user is visible
    await emailOption.click(); // Select the user by clic

  }

  // Public API used by test
  async assignStage1(assignee) {
    await this._assignRow(this.map[this.which].row1, assignee);
  }

  async assignStage2(assigneeL1, assigneeL2) {
    await this._assignRow(this.map[this.which].row2_l1, assigneeL1);
    await this._assignRow(this.map[this.which].row2_l2, assigneeL2);
  }

  async assertRootCauseStageVisible() {
    if (this.which !== 2) return; // Only applies to Flow 2
    const g = this._gadget();
    const stageHeader = g.getByRole('heading', { name: 'Root cause analyze', exact: true });
    const stageBlock = g.locator('[data-test-id="201810251843350638136498"]');
    await expect(stageHeader).toBeVisible();
    await expect(stageBlock).toBeVisible();
    await test.info().attach('Root cause analyze Stage appears', {
      body: await stageBlock.screenshot(),
      contentType: 'image/png'
    });

    console.log('Assertion Successful:When root cause is not known extra Stage:Root cause Analyzer appears');
    // ✨ highlight the section (stageBlock is the locator)
    await expectVisibleAndHighlight(this.page, stageBlock);


  }

  async next() {
    const g = this._gadget();
    await g.getByTestId(this.map[this.which].next).click();
  
  }
}
