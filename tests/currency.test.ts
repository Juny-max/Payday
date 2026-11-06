import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {displayAmount,initialVault,stateSchema,exchangeRatesSchema} from "../src/model";
const {fetchRates}=createRequire(import.meta.url)("../electron/exchange.cjs");
const rates={USD:.08,GBP:.06,asOf:"2026-11-06",fetchedAt:"2026-11-06T12:00:00.000Z",source:"Manual" as const};
test("display conversion is reversible without changing underlying figures",()=>{const vault=initialVault();vault.plan.salary=1500;const before=structuredClone(vault);assert.equal(displayAmount(1500,"USD",rates),120);assert.equal(displayAmount(1500,"GBP",rates),90);assert.equal(displayAmount(1500,"GHS",rates),1500);assert.deepEqual(vault,before);assert.throws(()=>displayAmount(1500,"USD"));});
test("old vaults still parse; invalid and missing rates cannot be used",()=>{assert.equal(stateSchema.parse(initialVault()).displayCurrency,undefined);for(const USD of [0,-1,NaN,Infinity])assert.equal(exchangeRatesSchema.safeParse({...rates,USD}).success,false);assert.equal(stateSchema.parse({...initialVault(),displayCurrency:"GBP",exchangeRates:rates}).displayCurrency,"GBP");});
test("exchange requests send only currency codes and validate provider output",async()=>{let url="";const result=await fetchRates(async(u:string)=>{url=u;return {ok:true,json:async()=>[{base:"GHS",quote:"USD",rate:.08,date:"2026-11-06"},{base:"GHS",quote:"GBP",rate:.06,date:"2026-11-06"}]};});assert.equal(url,"https://api.frankfurter.dev/v2/rates?base=GHS&quotes=USD,GBP");assert.equal(result.USD,.08);assert.equal(result.source,"Frankfurter");await assert.rejects(fetchRates(async()=>({ok:true,json:async()=>[]})));await assert.rejects(fetchRates(async()=>({ok:false})));});
