// pages/submit.page.js
import { expect } from '@playwright/test';
import { Gadgets } from './gadgets.page.js';

export class SubmitPage {
  constructor(page) {
    this.page = page;
    this.g = new Gadgets(page);
  }

  // If your final page is gadget2, change to gadget2 here.
  get gFrame() {
    const { gadget1 } = this.g.frames();
    return gadget1;
  }

  async clickSubmit() {
    await this.gFrame.getByRole('button', { name: 'Submit workflow' }).click();
  }

  async expectAttachmentError() {
    await this.gFrame
      .getByText(/(Please add.*attachment|attachment\s+required|Bitte.*Anlage)/i)
      .waitFor({ state: 'visible' });
  }

  async attach(filePath) {
    await this.gFrame.getByTestId('2015111614330806168211').click(); // Attachments tab
    await this.gFrame.getByLabel('Select file(s)').setInputFiles(filePath);
    await this.gFrame.getByRole('button', { name: 'Attach' }).click();
  }

  async expectSubmittedAndContinue() {
    await expect(this.gFrame.getByTestId('20141009112850013217103')).toBeVisible();
    await expect(this.gFrame.getByTestId('2016083016191602341167946').nth(3)).toBeVisible();
    await this.gFrame.getByTestId('201801251600250686412485').click(); // OK / continue
  }
}
