import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';
const meta=await sharp('public/icon.png').metadata();assert.equal(meta.width,512);assert.equal(meta.height,512);assert.ok(meta.hasAlpha);
const ico=await readFile('public/icon.ico');assert.equal(ico.readUInt16LE(2),1);const count=ico.readUInt16LE(4);const sizes=Array.from({length:count},(_,i)=>ico[6+i*16]||256);assert.deepEqual(sizes,[16,24,32,48,64,128,256]);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({args:['scripts/desktop-harness.cjs'],env});
try{const page=await app.firstWindow();await page.getByRole('button',{name:'Overview',exact:true}).waitFor();const logo=page.locator('.sidebar-brand img');await logo.waitFor();assert.ok(await logo.evaluate(img=>img.complete&&img.naturalWidth===512&&getComputedStyle(img).filter==='none'));assert.equal(await page.locator('img[src$="icon.svg"]').count(),0);const native=await app.evaluate(({nativeImage},iconPath)=>({empty:nativeImage.createFromPath(iconPath).isEmpty()}),path.resolve('public/icon.ico'));assert.equal(native.empty,false);await page.screenshot({path:'artifacts/branding-1.5.2.png'});assert.equal((await page.evaluate(()=>window.payday.load())).vault,null);console.log('PASS: transparent 512px logo; seven ICO resolutions; Electron loads the ICO; in-app branding renders in original blue; fresh test vault unchanged.');}finally{await app.close();}
