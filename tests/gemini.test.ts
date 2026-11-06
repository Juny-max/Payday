import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initialVault } from "../src/model";
const { MODEL, generatePlan, parsePlanResponse, formatGeminiError, checkKey } =
  createRequire(import.meta.url)("../electron/gemini.cjs");
const reply = () => ({
  ...initialVault().plan,
  salary: 1500,
  daily: 25,
  month: "2026-11",
  workWeek: [1, 2, 3, 4, 5],
  days: 22,
  savings: 225,
  bulk: 450,
  outside: 225,
  wardrobe: 75,
  partner: 0,
  wishes: [],
  explanation: "Synthetic test reply",
});
test("AI request uses working model, low thinking and explicit calendar context", async () => {
  const current = { ...initialVault().plan, month: "2026-11" },
    before = structuredClone(current);
  let request: any;
  const p = await generatePlan({
    apiKey: "fake",
    prompt: "Paid 1500, fare 25 Monday-Friday",
    current,
    generate: async (r: any) => {
      request = r;
      return { text: JSON.stringify(reply()) };
    },
  });
  assert.equal(request.model, "gemini-3.5-flash");
  assert.equal(request.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(JSON.parse(request.contents).calendar.weekdayOccurrences[1], 5);
  assert.equal(p.days, 21);
  assert.equal(p.salary, 1500);
  assert.equal(p.id, current.id);
  assert.deepEqual(current, before);
});
test("AI malformed JSON and invalid numbers are response errors, not key errors", () => {
  for (const text of [
    "",
    "not-json",
    JSON.stringify({ ...reply(), salary: -1 }),
  ]) {
    assert.throws(() => parsePlanResponse(initialVault().plan, text));
  }
  assert.match(
    formatGeminiError({
      code: "BUDGET_VALIDATION",
      message: "Invalid amounts",
    }),
    /Gemini replied/,
  );
});
test("AI over-budget output is rejected without altering the current draft", async () => {
  const current = { ...initialVault().plan, month: "2026-11" },
    before = structuredClone(current);
  await assert.rejects(
    generatePlan({
      apiKey: "fake",
      prompt: "Test",
      current,
      generate: async () => ({
        text: JSON.stringify({ ...reply(), savings: 2000 }),
      }),
    }),
    /budget could not be used.*exceeds/,
  );
  assert.deepEqual(current, before);
});
test("provider errors distinguish model, quota, key, timeout and network", () => {
  assert.match(
    formatGeminiError({ status: 404, message: "Model removed" }),
    /model unavailable/,
  );
  assert.match(
    formatGeminiError({ status: 429, message: "quota" }),
    /quota or rate limit/,
  );
  assert.match(
    formatGeminiError({ status: 403, message: "denied" }),
    /key or its permissions/,
  );
  assert.match(
    formatGeminiError({ status: 504, message: "deadline" }),
    /timed out/,
  );
  assert.match(
    formatGeminiError({ message: "fetch failed" }),
    /Cannot reach Google/,
  );
});
test("error messages never expose the saved key", () => {
  const secret = "AIza-test-private-value";
  const message = formatGeminiError(
    {
      status: 404,
      message: JSON.stringify({
        error: { message: `Request key=${secret} denied` },
      }),
    },
    secret,
  );
  assert.ok(!message.includes(secret));
  assert.match(message, /redacted/);
});
test("connection verification requires an actual nonempty generated reply", async () => {
  assert.deepEqual(await checkKey("fake", async () => ({ text: "OK" })), {
    model: MODEL,
  });
  await assert.rejects(
    checkKey("fake", async () => ({ text: "" })),
    /no test reply/,
  );
  await assert.rejects(
    checkKey("fake", async () => {
      throw { status: 429, message: "quota" };
    }),
    /quota/,
  );
});

 test("conversation accepts greetings and follow-up questions without changing a zero draft", async () => {
  const current = initialVault().plan, before = structuredClone(current);
  let request: any;
  const result = await generatePlan({ apiKey: "fake", prompt: "yo", current, conversation: true, generate: async (r: any) => { request = r; return {text: JSON.stringify({ replyOnly: true, explanation: "Hi! What would you like to talk through?" })}; } });
  assert.match(result.reply, /Hi!/);
  assert.deepEqual(current, before);
  assert.ok(request.config.responseJsonSchema.required.includes("replyOnly"));
});
 test("conversation budget changes still receive affordability validation", async () => {
  await assert.rejects(generatePlan({ apiKey: "fake", prompt: "plan", current: initialVault().plan, conversation: true, generate: async () => ({text: JSON.stringify({...reply(), replyOnly:false, savings:5000})}) }), /exceeds/);
});

test("chat includes selected saved budget and minimal savings context", async () => {
 const current = {...reply(), days:21}; let request:any;
 const appContext = {savingsBalance:900, selfDebt:50};
 await generatePlan({ apiKey:"fake", prompt:"How much have I planned?", current, appContext, conversation:true, generate:async(r:any)=>{request=r;return {text:JSON.stringify({replyOnly:true,explanation:"Your selected payday salary is 1500."})};} });
 const sent=JSON.parse(request.contents);assert.equal(sent.currentPlan.salary,1500);assert.deepEqual(sent.appContext,appContext);assert.match(request.config.systemInstruction,/read them before answering/);
});
