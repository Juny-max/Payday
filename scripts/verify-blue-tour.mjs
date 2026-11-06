import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {initialVault}=createRequire(import.meta.url)('../electron/model.cjs');
const env={...process.env,PAYDAY_TEST_FIRST_USE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['scripts/desktop-harness.cjs'],env});
try {
 const page=await app.firstWindow();await page.getByRole('dialog',{name:'Start with your payday',exact:true}).waitFor();
 await page.screenshot({path:'artifacts/tour-first-use-local.png'});
 await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Skip tour',exact:true}).evaluate(e=>e===document.activeElement),true);
 const titles=['Start with your payday','Give every amount a purpose','Your four money pockets','Fund something you want','Keep a record of your paydays','Talk through your plan','Choose your currency view','Keep a backup','Know when an update is ready','You control your data'];
 for(let i=0;i<titles.length;i++){
  const dialog=page.getByRole('dialog',{name:titles[i],exact:true});await dialog.waitFor();const fits=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;});assert.ok(fits,`Tour step ${i} fits viewport`);
  if(i===5){const box=await page.locator('.chat-page').evaluate(e=>({radius:getComputedStyle(e).borderRadius,border:getComputedStyle(e).borderTopWidth,bottom:e.getBoundingClientRect().bottom,height:innerHeight}));assert.equal(box.radius,'0px');assert.equal(box.border,'0px');assert.ok(box.bottom<=box.height+2);}
  await page.getByRole('button',{name:i===titles.length-1?'Finish tour':'Next',exact:true}).click();
 }
 assert.equal(await page.getByRole('dialog').count(),0);let loaded=await page.evaluate(()=>window.payday.load());assert.equal(loaded.vault,null);assert.equal(loaded.showTour,false);
 await page.reload();await page.getByRole('button',{name:'Overview',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
 for(const text of ['Small steps. A stronger tomorrow.','Enter your pay to start','Draft plan',"Let's make this payday count."])assert.equal(await page.getByText(text,{exact:true}).count(),0);
 assert.equal(await page.locator('.dock .dock-payday').count(),0);assert.equal(await page.locator('button.avatar').count(),0);
 assert.equal(await page.locator('.balance-actions .primary').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(37, 99, 235)');
 assert.match(await page.locator('.savings-card').evaluate(e=>getComputedStyle(e).backgroundImage),/37, 99, 235/);
 await page.screenshot({path:'artifacts/blue-overview-local.png',animations:'disabled'});
 await page.getByRole('button',{name:'Help & getting started',exact:true}).click();await page.getByRole('dialog',{name:titles[0],exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Payday co-pilot',exact:true}).click();await page.screenshot({path:'artifacts/blue-chat-local.png',animations:'disabled'});const chat=await page.locator('.chat-page').evaluate(e=>({radius:getComputedStyle(e).borderRadius,border:getComputedStyle(e).borderTopWidth}));assert.deepEqual(chat,{radius:'0px',border:'0px'});
 assert.equal((await page.evaluate(()=>window.payday.load())).vault,null);
 const fixture=initialVault();fixture.plan.salary=1234;await page.evaluate(v=>window.payday.save(v),fixture);
 const testDir=await app.evaluate(({app})=>app.getPath('userData'));assert.ok(path.resolve(testDir).startsWith(path.resolve('artifacts')+path.sep));await writeFile(path.join(testDir,'payday-onboarding.json'),'{');await page.reload();await page.getByRole('button',{name:'Overview',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual((await page.evaluate(()=>window.payday.load())).vault,fixture);
 console.log('PASS: first-use 10-step tour, bounded/focus-trapped dialog, no repeat after reload, Help restarts, Escape closes, blue identity, removed labels/sidebar CTA/profile, integrated chat, tour leaves financial data untouched; corrupt optional preferences do not block existing records.');
}finally{await app.close();}
