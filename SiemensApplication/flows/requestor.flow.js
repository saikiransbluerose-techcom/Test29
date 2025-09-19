// flows/requestor.flow.js
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { loadAppConfig } from '../utils/app.js';
import { ENV } from '../utils/env.js';
import { readExcelScenario } from '../utils/data.js'; 
import dotenv from 'dotenv';
import { LoginPage } from '../pages/login.page.js';
import { LoginWithNonSSOPage } from '../pages/loginPageNonSSO.js';
import { Header } from '../pages/header.page.js';
import { StartWorkflowChooserPage } from '../pages/start-workflow-chooser.page.js';
import { WorkDetailsPage } from '../pages/work-details.page.js';
import { StagesRolesPage } from '../pages/stages-roles.page.js';
import { NotificationsPage } from '../pages/notifications.page.js';
import { SummaryPage } from '../pages/summary.page.js';


const APP = loadAppConfig();

/**
 * Read string field from StartWorkflow sheet, fail fast if empty.
 */
function SWValue(SW, key) {
  const v = String(SW[key] ?? '').trim();
  if (!v) throw new Error(`StartWorkflow["${key}"] is empty in Excel`);
  return v;
}


/**
 * Requestor flow (main request creation)
 * - Reads a single Excel scenario
 * - Logs in 
 * - Starts workflow, fills Work Details
 * - Assigns stages & roles
 * - Adds notifications
 * - Submits and returns caseId
 *
 * Params:
 *  - page: Playwright Page
 *  - which: 1 or 2 (branching for causeKnown)
 *  - options: { scenario?: string, mode?: 'normal' | 'validation' }
 */


export async function runWorkflow(page, which, { scenario = 'Test Data 1', mode = 'normal' } = {}) {
  test.slow();

 
  
  // ------------------------------------------------------------
  //  Read Excel for this scenario (SW + assignees)
  // ------------------------------------------------------------
   const { SW, ASSIGNEES } = readExcelScenario(scenario);

  // --- Login with Siemenes User ID---
  // Login with Siemens ID is commented, as it is asking for extra verification, and for that whitelisting needs to be done

  // const login = new LoginPage(page);
  // await login.goto();
  // await login.loginWithSiemensId(ENV.LOGIN_USER, ENV.LOGIN_PASS);


  //-- Login with NON-SSO user
  const loginwithNonSSO = new LoginWithNonSSOPage(page);
  await loginwithNonSSO.goto();
  await loginwithNonSSO.loginWithNonSSOUser(ENV.LOGIN_NONSSO_USER, ENV.APPROVER_DEFAULT_PASS);

   // --- Header → Start Workflow ---
  const header = new Header(page);
  await page.waitForTimeout(5000);
  await header.refreshAndEnterStartWorkflow();

  // --- Choose case/workflow ---
  const chooser = new StartWorkflowChooserPage(page);
  await chooser.selectCaseAndWorkflow({
    flowClassId: SWValue(SW, 'flowClassId'),
    workflowId: SWValue(SW, 'workflowId'),
  });

  // --- Work Details ---
  const work = new WorkDetailsPage(page);

  if (mode === 'validation') {
        // Fill core with targeted skips to trigger 3-field validation
    await work.fillCore({
      itemIndex: SWValue(SW, 'itemIndex'),
      articleTitle: SWValue(SW, 'articleTitle'),
      specTarget: SWValue(SW, 'specTarget'),
      deviationDesc: SWValue(SW, 'deviationDesc'),
      partsChecked: SWValue(SW, 'partsChecked'),
      failureRate: SWValue(SW, 'failureRate'),
    }, { skipArticleTitle: true, skipPartsChecked: true });

    // Cause is known branch
    if (which === 1) {
      await work.setCauseKnownYes({
        causeKnown: SWValue(SW, 'causeKnown'),
        correctiveDefined: SWValue(SW, 'correctiveDefined'),
      });
    } else {
      await work.setCauseKnownNo(
        {
          causeKnown2: SWValue(SW, 'causeKnown2'),
          correctiveDefined: SWValue(SW, 'correctiveDefined'),
        },
        String(ASSIGNEES[5]?.searchText || '').trim(),
        String(ASSIGNEES[5]?.displayText || '').trim()
      );
    }
     // More fields with one skip to keep validation active
    await work.moreFields({
      quantity: SWValue(SW, 'quantity'),
      dateISO: SW['dateISO'],
      changeNumber: SWValue(SW, 'changeNumber'),
      superOrdinateArticleNo: SWValue(SW, 'superOrdinateArticleNo'),
      measures3D: SWValue(SW, 'measures3D'),
      affectedCustomer: SWValue(SW, 'affectedCustomer'),
      causingProcess: SWValue(SW, 'causingProcess'),
      reqSpecial: SWValue(SW, 'reqSpecial'),
      needChanges: SWValue(SW, 'needChanges'),
      deliveryImpact: SWValue(SW, 'deliveryImpact'),
      rootCauseAnalysis: which === 2 ? SWValue(SW, 'rootCauseAnalysis') : '',
      correctiveAction: SWValue(SW, 'correctiveAction'),
    }, { skipCorrectiveAction: true });

      // Trigger and assert field-level validation, then fix missing fields
    await work.save();
    await work.expectThreeFieldErrors();
    await work.expectTopBannerErrorsAndHighlight();

    await work.fillMainFields({
      articleTitle: SWValue(SW, 'articleTitle'),
      partsChecked: SWValue(SW, 'partsChecked'),
      correctiveAction: SWValue(SW, 'correctiveAction'),
    });
    await work.save();

  } else {
    // Normal flow
    await work.fillCore({
      itemIndex: SWValue(SW, 'itemIndex'),
      articleTitle: SWValue(SW, 'articleTitle'),
      specTarget: SWValue(SW, 'specTarget'),
      deviationDesc: SWValue(SW, 'deviationDesc'),
      partsChecked: SWValue(SW, 'partsChecked'),
      failureRate: SWValue(SW, 'failureRate'),
    });

    if (which === 1) {
      await work.setCauseKnownYes({
        causeKnown: SWValue(SW, 'causeKnown'),
        correctiveDefined: SWValue(SW, 'correctiveDefined'),
      });
    } else {
      await work.setCauseKnownNo(
        {
          causeKnown2: SWValue(SW, 'causeKnown2'),
          correctiveDefined: SWValue(SW, 'correctiveDefined'),
        },
        String(ASSIGNEES[5]?.searchText || '').trim(),
        String(ASSIGNEES[5]?.displayText || '').trim()
      );
    }

    await work.moreFields({
      quantity: SWValue(SW, 'quantity'),
      dateISO: SW['dateISO'],
      changeNumber: SWValue(SW, 'changeNumber'),
      superOrdinateArticleNo: SWValue(SW, 'superOrdinateArticleNo'),
      measures3D: SWValue(SW, 'measures3D'),
      affectedCustomer: SWValue(SW, 'affectedCustomer'),
      causingProcess: SWValue(SW, 'causingProcess'),
      reqSpecial: SWValue(SW, 'reqSpecial'),
      needChanges: SWValue(SW, 'needChanges'),
      deliveryImpact: SWValue(SW, 'deliveryImpact'),
      rootCauseAnalysis: which === 2 ? SWValue(SW, 'rootCauseAnalysis') : '',
      correctiveAction: SWValue(SW, 'correctiveAction'),
    });
  }

    // ------------------------------------------------------------
  // Attachment and Next (skipped in validation mode)
  // ------------------------------------------------------------
  if (mode !== 'validation') {
    await work.uploadAndNext({ uploadFilePath: SWValue(SW, 'uploadFilePath'), clickNext: true });
  }

  // Stages & Roles — assign Stage1 and Stage2
  const stages = new StagesRolesPage(page, which);
  await stages.assignStage1({
    searchText: String(ASSIGNEES[0]?.searchText || '').trim(),
    displayText: String(ASSIGNEES[0]?.displayText || '').trim(),
  });
  await stages.assignStage2(
    { searchText: String(ASSIGNEES[1]?.searchText || '').trim(), displayText: String(ASSIGNEES[1]?.displayText || '').trim() },
    { searchText: String(ASSIGNEES[2]?.searchText || '').trim(), displayText: String(ASSIGNEES[2]?.displayText || '').trim() }
  );
  if (which === 2) await stages.assertRootCauseStageVisible();
  await stages.next();

  // --- Notifications ---add directory user and optional email
    const notif = new NotificationsPage(page);
  if(which ==1)
  {await notif.addDirectoryUserByText(
    String(ASSIGNEES[3]?.searchText || '').trim(),
    String(ASSIGNEES[3]?.displayText || '').trim()
  );}

  if (which ==1){await notif.addEmailIfPresent(String(ASSIGNEES[4]?.emailIfAny || '').trim());}
  await notif.next();

  // --- Summary --validation (if needed), submit, capture caseId
  const summary = new SummaryPage(page);

  if (mode === 'validation') {
    await summary.triggerMissingAttachmentValidation();
    await work.uploadAndNext({ uploadFilePath: SWValue(SW, 'uploadFilePath'), clickNext: false });
  }

  const caseId = await summary.submitAndCaptureCaseId();
  return { caseId };
}
