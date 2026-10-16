// Explicit opt-in staging acceptance. Creates a synthetic workspace through the UI.
// Requires Playwright + Chromium, the new migration, financial templates and an
// authenticated test user with NO memberships. Never point this at Production.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const { ONBOARDING_STAGING_URL: base, ONBOARDING_TEST_EMAIL: email, ONBOARDING_TEST_PASSWORD: password } = process.env;
assert.equal(process.env.ALLOW_ONBOARDING_STAGING_WRITE, 'true', 'Explicit staging-write opt-in required');
assert.ok(base && email && password, 'Staging URL and synthetic account credentials required');
assert.equal(new URL(base).protocol, 'https:');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(new URL('/login', base).href);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('link', { name: 'Set up a new workspace' }).waitFor();
  await page.getByRole('link', { name: 'Set up a new workspace' }).click();
  await page.getByRole('heading', { name: 'Finish your workspace setup' }).waitFor();
  const code = `PILOT-${Date.now()}`;
  await page.getByLabel('Your full name').fill('Staging Onboarding Tester');
  await page.getByLabel('Client / organisation name').fill(`Staging ${code}`);
  await page.getByLabel('First legal entity name').fill(`Staging Entity ${code}`);
  await page.getByLabel('Legal entity code (unique reference)').fill(code);
  await page.getByLabel('Your organisational role').fill('Pilot reviewer');
  assert.equal(await page.getByLabel('Work email').inputValue(), email);
  assert.ok(await page.getByLabel('Work email').evaluate(el => el.readOnly));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  const response = page.waitForResponse(r => r.url().includes('/rpc/provision_client_account') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Complete workspace setup' }).click();
  const completed = await response;
  assert.equal(completed.status(), 200);
  const result = await completed.json();
  assert.equal(result.status, 'provisioned'); assert.ok(result.entity_id);
  await page.waitForURL(url => url.pathname === '/settings/financial/readiness');
  await page.getByRole('heading', { name: 'Financial setup', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Return to workspace' }).click();
  await page.waitForURL(url => url.pathname === '/app');
  await page.getByText('Verifying workspace access…', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Your workspace is not connected yet' }).count(), 0);
  // Same authenticated actor submits again: SQL must return the same receipt.
  await page.goto(new URL('/signup', base).href);
  await page.getByRole('heading', { name: 'Finish your workspace setup' }).waitFor();
  for (const [label, value] of [['Your full name','Staging Onboarding Tester'],['Client / organisation name','Retry'],['First legal entity name','Retry'],['Legal entity code (unique reference)',code],['Your organisational role','Pilot reviewer']]) await page.getByLabel(label).fill(value);
  const retried = page.waitForResponse(r => r.url().includes('/rpc/provision_client_account') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Complete workspace setup' }).click();
  assert.deepEqual(await (await retried).json(), result);
  console.log('PASS: existing-user mobile onboarding, canonical confirmation, application entry and idempotent retry');
} finally { await browser.close(); }
