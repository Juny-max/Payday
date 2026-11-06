import {test} from "node:test";
import assert from "node:assert/strict";
import {initialVault,nextPaydayPlan,balancePlan,commitPayday} from "../src/model";
test("the same salary can be budgeted for 24 separate monthly paydays without duplicate savings",()=>{
 let vault=initialVault();
 for(let month=0;month<24;month++){
  const date=new Date(Date.UTC(2026,month,10,12));
  const fresh=nextPaydayPlan(vault.plan,date);
  assert.equal(fresh.salary,0);
  vault={...vault,plan:balancePlan({...fresh,salary:1500,daily:25,workWeek:[1,2,3,4,5]})};
  vault=commitPayday(vault);
  assert.throws(()=>commitPayday(vault),/already saved/);
 }
 assert.equal(vault.history.length,24);
 assert.equal(new Set(vault.history.map(h=>h.planId)).size,24);
 assert.equal(vault.savingsBalance,5400);
 assert.ok(vault.history.every(h=>h.salary===1500));
});
