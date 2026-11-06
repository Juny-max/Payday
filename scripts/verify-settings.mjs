import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['scripts/ai-ui-harness.cjs'],env});
try {
 const page=await app.firstWindow();await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
 for(const tab of ['Accounts','Currency','AI co-pilot','Backups & storage','Updates','Reset & uninstall']) assert.ok(await page.getByRole('tab',{name:tab,exact:true}).count());
 await page.getByLabel('gcb account name',{exact:true}).fill('My savings');await page.getByRole('button',{name:'Save account names',exact:true}).click();await page.getByText('Account names updated.',{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.payday.load())).vault.accountNames.gcb,'My savings');
 await page.getByRole('tab',{name:'Reset & uninstall',exact:true}).click();await page.getByRole('button',{name:'Reset everything',exact:true}).click();await page.getByRole('dialog',{name:'Reset all Payday data?'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);assert.equal((await page.evaluate(()=>window.payday.load())).vault.accountNames.gcb,'My savings');
 assert.equal(await page.getByRole('button',{name:'Open settings',exact:true}).count(),0);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/settings-1.4.5.png',fullPage:true});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,820));await page.screenshot({path:'artifacts/settings-1.4.5-narrow.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();assert.equal(await page.getByLabel('gcb account name',{exact:true}).inputValue(),'My savings');
 console.log('PASS: Settings is a page; all sections present; account edit persists across reload; reset confirmation cancels without data loss; sidebar entry works; narrow layout has no horizontal overflow.');
} finally {await app.close();}
