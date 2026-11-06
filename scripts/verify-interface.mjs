import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {monthNow}=createRequire(import.meta.url)('../electron/model.cjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Skip tour',exact:true}).click();await page.getByRole('button',{name:'Start payday allocation',exact:true}).click();
 assert.equal(await page.getByLabel('Payday month',{exact:true}).inputValue(),monthNow());assert.equal(await page.getByRole('spinbutton',{name:'Take-home salary'}).inputValue(),'0');assert.equal(await page.getByRole('spinbutton',{name:'Days per week'}).inputValue(),'0');
 await page.getByLabel('Payday month',{exact:true}).fill('2027-03');await page.getByRole('spinbutton',{name:'Days per week'}).fill('5');await page.getByRole('spinbutton',{name:'Take-home salary'}).fill('999999.99');await page.getByRole('spinbutton',{name:'Daily in & out fare'}).fill('25');
 assert.match(await page.locator('.calendar-summary').innerText(),/23 scheduled/);
 await page.getByRole('spinbutton',{name:/^Savings/}).fill('0');assert.ok(Number((await page.locator('.planner-total strong').innerText()).replace(/[^\d.]/g,''))>0);
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.locator('.donut-legend button').filter({hasText:'Telecel Cash'}).hover();assert.match(await page.locator('.allocation-hover-detail').innerText(),/575\.00/);assert.equal(await page.locator('.recharts-tooltip-wrapper').count(),0);
 const fits=await page.locator('.donut-label').evaluate(el=>{const text=el.querySelector('strong').getBoundingClientRect(),label=el.getBoundingClientRect();return text.width<=label.width && text.left>=label.left-1 && text.right<=label.right+1;});assert.ok(fits);assert.ok(!(await page.locator('.donut-label strong').innerText()).includes('GH'));
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('textbox',{name:'gcb account name'}).fill('My savings');await page.getByRole('textbox',{name:'first account name'}).fill('My lifestyle bank');await page.getByRole('button',{name:'Save account names'}).click();await page.getByRole('status').filter({hasText:'Account names updated.'}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();assert.match(await page.locator('.savings-brand').innerText(),/My savings/);assert.match(await page.locator('.breakdown-rows').innerText(),/My lifestyle bank/);
 for(const phrase of ['Personal workspace','Stored on this device','Offline first. Private by default.','Made for your payday. Not your every day.','A calmer way to budget'])assert.equal(await page.getByText(phrase,{exact:true}).count(),0);
 await page.screenshot({path:'artifacts/payday-1.3-chart.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Skip tour',exact:true}).click();await page.getByRole('button',{name:'Start payday allocation',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Take-home salary'}).inputValue(),'0');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: zero/current-month start, 5/week = 23 March workdays, manual remainder, large-value chart fit, correct outside-ring readout, account renaming, removed copy, temporary preview reset and narrow layout.');
} finally {await browser.close();}
