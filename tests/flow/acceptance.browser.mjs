// Opt-in only: creates a draft action in isolated staging; NEVER sends email.
// Requires migrated staging, a scoped test user and real issued test statements.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const {FLOW_STAGING_URL:base,FLOW_TEST_EMAIL:email,FLOW_TEST_PASSWORD:password,FLOW_TEST_INSTRUCTION:instruction}=process.env;
assert.equal(process.env.ALLOW_FLOW_STAGING_DRAFT,'true');
assert.ok(base&&email&&password&&instruction,'Explicit isolated staging URL, test identity and instruction required');
assert.equal(new URL(base).protocol,'https:');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(new URL('/login',base).href);
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/login');
 await page.goto(new URL('/flow',base).href);await page.getByRole('heading',{name:'Flow',exact:true}).waitFor();
 await page.getByLabel('What would you like Flow to prepare?').fill(instruction);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/flow/statements')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Prepare for review',exact:true}).click();const result=await response;assert.equal(result.status(),200);
 const action=await result.json();assert.equal(action.status,'review',action.reason);assert.equal(action.manifest.attachments.length,action.months);
 await page.getByText(action.manifest.recipient,{exact:true}).waitFor();
 assert.ok(await page.getByRole('button',{name:'Approve and submit email'}).isDisabled());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
 for(const width of [768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 console.log(`Draft reviewed without sending: ${action.id}`);
}finally{await browser.close();}
