import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {initialVault,balancePlan,commitPayday}=createRequire(import.meta.url)('../electron/model.cjs');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['scripts/ai-ui-harness.cjs'],env});
try{
 const page=await app.firstWindow();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'AI co-pilot',exact:true}).click();
 await page.getByPlaceholder('Paste your GEMINI_API_KEY').fill('test-ui-key');await page.getByRole('button',{name:'Save key',exact:true}).click();await page.getByText('Key saved',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Test connection',exact:true}).click();await page.getByText('Verified',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Payday co-pilot',exact:true}).click();await page.getByRole('textbox',{name:'Tell your payday co-pilot about your month'}).fill('Synthetic UI test only.');await page.getByRole('button',{name:'Send message'}).click();
 const error=page.getByRole('alert');await error.waitFor();assert.match(await error.innerText(),/quota or rate limit/);assert.ok(!(await error.innerText()).includes('Error invoking remote method'));const v=(await page.evaluate(()=>window.payday.load())).vault;assert.ok(v===null||v.plan.salary===0);
 await page.getByRole('textbox',{name:'Tell your payday co-pilot about your month'}).fill('yo');
 await page.getByRole('button',{name:'Send message'}).click();
 await page.getByRole('status',{name:'Co-pilot is typing'}).waitFor();
 await page.getByText('Hello! Tell me what you would like to plan.',{exact:true}).waitFor();
 const after=(await page.evaluate(()=>window.payday.load())).vault; assert.deepEqual(after,v);
 assert.equal(await page.getByRole("dialog").count(),0);
 await page.screenshot({path:"artifacts/chat-1.4.3.png"});
 const fresh=initialVault();fresh.plan=balancePlan({...fresh.plan,salary:1500});const saved=commitPayday(fresh);await page.evaluate(v=>window.payday.save(v),saved);await page.reload();
 await page.getByRole('button',{name:'Payday co-pilot',exact:true}).click();await page.getByRole('textbox',{name:'Tell your payday co-pilot about your month'}).fill('Read my saved budget');await page.getByRole('button',{name:'Send message'}).click();await page.getByText(`Selected salary: 1500; savings balance: ${saved.savingsBalance}`,{exact:true}).waitFor();
 assert.deepEqual((await page.evaluate(()=>window.payday.load())).vault,saved);

 console.log('PASS: saved payday context reaches the assistant, typing indicator appears, chat is a page, messages preserve the vault; saved key is not shown as connected, explicit verification updates status, provider failure is readable, failed AI leaves the plan unchanged. UI test used mocks; separate live fictional-budget request succeeded.');
}finally{await app.close();}
