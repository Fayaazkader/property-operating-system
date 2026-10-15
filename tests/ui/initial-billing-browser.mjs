import assert from 'node:assert/strict';
import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import { resolve } from 'node:path';
// Start the development server with isolated dummy local Supabase configuration.
// This runner mounts a synthetic-data page using the actual workflow component,
// removes it afterward, and never calls production or changes feature flags.
const mount='app/(public)/execution/sign/__local-review';
const artifacts=resolve(process.env.ASSETFLOW_UI_ARTIFACTS??'../activation-ui-evidence');
await mkdir(mount,{recursive:true});await copyFile('tests/ui/fixtures/initial-billing-page.tsx',mount+'/page.tsx');await mkdir(artifacts,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto((process.env.ASSETFLOW_UI_URL??'http://127.0.0.1:3100')+'/execution/sign/__local-review',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Open initial charges',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review initial charges'});await dialog.waitFor();
 await page.getByRole('checkbox',{name:'Include Tenant Deposit',exact:true}).uncheck();
 const amount=await page.locator('output').textContent();assert.equal(amount.replace(/\D/g,''),'1150000');
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'Open initial charges',exact:true}).evaluate(node=>node===document.activeElement),true);
 await page.getByRole('button',{name:'Open initial charges',exact:true}).click();await dialog.waitFor();
 await page.getByRole('button',{name:'Approve charges and issue invoice',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.match(await page.getByRole('alert').textContent(),/Reload before approval/);
 await page.getByRole('button',{name:'Reload review',exact:true}).click();await page.getByRole('checkbox',{name:'Include Tenant Deposit',exact:true}).waitFor();
 assert.equal((await page.locator('output').textContent()).replace(/\D/g,''),'3150000');
 await page.screenshot({path:artifacts+'/initial-billing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const bounds=await dialog.boundingBox();assert.ok(bounds.width<=390&&bounds.height<=844);
 for(const box of await dialog.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)))assert.ok(box>=44);
 await page.screenshot({path:artifacts+'/initial-billing-mobile.png',fullPage:true});
 await page.evaluate(()=>{document.documentElement.classList.remove('dark');document.documentElement.classList.add('theme-light');});
 await page.screenshot({path:artifacts+'/initial-billing-light-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Approve charges and issue invoice',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Charges approved'}).waitFor();
 assert.equal(await page.locator('dialog[open]').count(),0);
 const ownErrors=errors.filter(message=>!message.includes('fetch failed')&&!message.includes('Failed to fetch'));
 assert.deepEqual(ownErrors,[]);
 const result={passed:true,checks:['native focus containment','Escape and focus restoration','selection totals','recoverable approval failure','reload review','no mobile document overflow','44px action targets','dark/light rendered evidence','successful completion'],viewportEvidence:[{width:1440,height:1000},{width:390,height:844}],backend:'synthetic component adapter; no live backend',screenshots:['initial-billing-desktop.png','initial-billing-mobile.png','initial-billing-light-mobile.png']};
 await writeFile(artifacts+'/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await rm(mount,{recursive:true,force:true});}
