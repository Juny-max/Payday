const { z } = require("zod");
const {
  amount,
  planSchema: plan,
  calendarWorkdays,
  transport,
  dataCost,
  nightCost,
  validatePlan,
} = require("./model.cjs");
const MODEL = "gemini-3.5-flash";
class BudgetError extends Error {
  constructor(message) {
    super(message);
    this.code = "BUDGET_VALIDATION";
  }
}
function scrub(text, key = "") {
  return String(text)
    .replaceAll(key || "__NO_KEY__", "[redacted]")
    .replace(/AIza[\w-]{20,}/g, "[redacted]")
    .slice(0, 700);
}
function formatGeminiError(err, key = "") {
  let detail = String(err?.message || "");
  let status = Number(err?.status || 0);
  try {
    const parsed = JSON.parse(detail);
    detail = parsed.error?.message || detail;
    status = status || parsed.error?.code || 0;
  } catch {}
  detail = scrub(detail, key);
  if (err?.code === "BUDGET_VALIDATION")
    return `Gemini replied, but its budget could not be used: ${detail}`;
  if (status === 404) return `Gemini model unavailable (404). ${detail}`;
  if (status === 429)
    return "Gemini quota or rate limit reached (429). Check the API project quota/billing in Google AI Studio, or wait if the limit is temporary.";
  if (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|API key not valid/i.test(detail)
  )
    return `Google rejected the API key or its permissions (${status || 400}). Check the saved Google AI Studio key and its API restrictions.`;
  if (status === 504 || /timeout|timed out|deadline|abort/i.test(detail))
    return "Gemini timed out. Google did not finish the request; please try again.";
  if (status >= 500)
    return `Google Gemini is temporarily unavailable (${status}). Please try again later.`;
  if (status === 400)
    return `Google rejected the Gemini request (400): ${detail}`;
  if (
    /fetch failed|ENOTFOUND|ECONN|network|certificate|socket|TLS/i.test(detail)
  )
    return "Cannot reach Google Gemini. Check your internet connection, proxy or firewall.";
  return `Gemini request failed${status ? ` (${status})` : ""}: ${detail || "No response was received."}`;
}
function parsePlanResponse(p, text) {
  try {
    if (!text?.trim())
      throw new Error(
        "No budget text was returned. Try again with a clear salary and weekly commute.",
      );
    const parsed = JSON.parse(text);
    const result = plan.parse({
      ...p,
      ...parsed,
      month: p.month,
      id: p.id,
      workWeek: parsed.workWeek ?? p.workWeek,
      wishes: [
        ...p.wishes,
        ...z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              cost: amount,
              contribution: amount,
            }),
          )
          .max(20)
          .parse(parsed.wishes)
          .map((w) => ({
            ...w,
            id: require("node:crypto").randomUUID(),
            funded: 0,
            bought: false,
          })),
      ],
    });
    if (result.workWeek)
      result.days = calendarWorkdays(result.month, result.workWeek);
    const total =
      result.savings +
      transport(result) +
      dataCost(result) +
      nightCost(result) +
      result.bulk +
      result.outside +
      result.wardrobe +
      result.partner +
      result.wishes
        .filter((w) => !w.bought)
        .reduce((n, w) => n + w.contribution, 0);
    if (
      total > result.salary + 0.005 ||
      result.wishes.some(
        (w) => !w.bought && w.funded + w.contribution > w.cost + 0.005,
      )
    )
      throw new Error(
        "The generated budget exceeds the available money. Try a smaller wishlist or adjust manually.",
      );
    validatePlan(result);
    return result;
  } catch (e) {
    if (e instanceof BudgetError) throw e;
    if (e.name === "ZodError")
      throw new BudgetError(
        "The reply contained missing or invalid amounts. Try again with salary, daily fare and work weekdays.",
      );
    throw new BudgetError(e.message);
  }
}
async function generatePlan({ apiKey, prompt, current, generate, conversation = false, appContext = null }) {
  const p = plan.parse(current);
  z.string().min(1).max(6000).parse(prompt);
  try {
    const ai = generate
      ? { models: { generateContent: generate } }
      : new (await import("@google/genai")).GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: JSON.stringify({
        request: prompt,
        currentPlan: p,
        appContext,
        calendar: {
          weekdayOccurrences: Array.from({ length: 7 }, (_, d) =>
            calendarWorkdays(p.month, [d]),
          ),
        },
      }),
      config: {
        httpOptions: { timeout: 90000 },
        thinkingConfig: { thinkingLevel: "LOW" },
        systemInstruction:
          (conversation ? "You are also a conversational assistant. currentPlan and appContext are the app records supplied with this request: read them before answering. Never say you have no financial details when these contain values. Distinguish the selected payday month from the current calendar month; do not claim an older budget is this month. Explain planned allocations, not an actual spendable bank balance, because daily spending is not tracked. appContext contains saved savings balance and internal debt; never infer missing bank balances. Questions asking how much is budgeted are replyOnly=true, not permission to change allocations. For greetings, questions, incomplete information, or discussion, set replyOnly=true and put a helpful natural reply or follow-up question in explanation. Preserve all current amounts in that case; zero salary is fine for conversation. Only set replyOnly=false when the user actually requests a budget and has provided enough information. Never turn a greeting into a budget. " : "") +
          "You are a Ghana payday budget planner. Never invent salary, fare or a weekly schedule the user has not provided. Interpret the user's personal situation and explicit requests, not a generic canned budget. Weekly schedules must be returned as workWeek weekday indices (Sunday=0, Monday=1 through Saturday=6). Five workdays means Monday-Friday; three means Monday-Wednesday unless specified otherwise. The selected calendar month stays currentPlan.month, including late or missed pay; never invent a future month. Use its actual calendar weekday count, never multiply by four or treat five as monthly days. Include workWeek in JSON. Keep existing goals and their funding intact. Do not invent income when the user has not supplied it. Return JSON with salary,daily,days,data (company/off, full, half, custom),dataRequested,dataReserve,dataMonthsRemaining,midnight,savings,bulk,outside,wardrobe,partner,wishes (only NEW wishes: name,cost,contribution),explanation. All money is GH cedis, nonnegative with 2 decimals. Preserve current settings unless user requests a change. Transport=daily*actual calendar workdays selected in workWeek. days is that monthly count, not weekly count. Data is OFF by default (company). Only enable if requested, never assume monthly recurring data. dataRequested can be any amount; dataReserve is what actually fits. company means dataReserve=0, midnight=0, dataMonthsRemaining=0. full/half/custom use dataRequested (399 or 200 are optional shortcuts), dataMonthsRemaining 1 or 2. Reserve commute first, protect feeding (offline baseline up to 45% of salary), then optional affordable data and savings up to 15%. On low pay reduce savings and lifestyle to zero as necessary. Midnight is optional 0-50 only with data on. Sum savings+transport+data+midnight+bulk+outside+wardrobe+partner+all existing unbought wish contributions+new wish contributions MUST be <=salary. Never change funded or bought records. Do not repeat existing wishes. Contribution cannot exceed cost. Explain account changes with amounts versus currentPlan and tradeoffs. Do not claim real bank transfers. If essentials exceed salary return all discretionary zero and explain infeasibility.",
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            ...(conversation ? { replyOnly: { type: "boolean" } } : {}),
            salary: { type: "number" },
            daily: { type: "number" },
            days: { type: "integer" },
            workWeek: {
              type: "array",
              items: { type: "integer", minimum: 0, maximum: 6 },
            },
            data: {
              type: "string",
              enum: ["company", "full", "half", "custom"],
            },
            dataRequested: { type: "number" },
            dataReserve: { type: "number" },
            dataMonthsRemaining: {
              type: "integer",
              minimum: 0,
              maximum: 2,
            },
            midnight: { type: "number" },
            savings: { type: "number" },
            bulk: { type: "number" },
            outside: { type: "number" },
            wardrobe: { type: "number" },
            partner: { type: "number" },
            wishes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  cost: { type: "number" },
                  contribution: { type: "number" },
                },
                required: ["name", "cost", "contribution"],
              },
            },
            explanation: { type: "string" },
          },
          required: [
            ...(conversation ? ["replyOnly"] : []),
            "salary",
            "daily",
            "days",
            "workWeek",
            "data",
            "dataRequested",
            "dataReserve",
            "dataMonthsRemaining",
            "midnight",
            "savings",
            "bulk",
            "outside",
            "wardrobe",
            "partner",
            "wishes",
            "explanation",
          ],
        },
      },
    });

    if (conversation) {
      const result = JSON.parse(response.text);
      if (result.replyOnly === true) {
        return { reply: z.string().trim().min(1).max(12000).parse(result.explanation) };
      }
    }
    return parsePlanResponse(p, response.text);
  } catch (e) {
    throw new Error(formatGeminiError(e, apiKey));
  }
}
async function checkKey(apiKey, generate) {
  try {
    const ai = generate
      ? { models: { generateContent: generate } }
      : new (await import("@google/genai")).GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: "Connection test only. Reply with OK.",
      config: {
        httpOptions: { timeout: 90000 },
        thinkingConfig: { thinkingLevel: "LOW" },
        maxOutputTokens: 1024,
      },
    });
    if (!response.text?.trim())
      throw new Error(
        "Google returned no test reply. Try the connection test again.",
      );
    return { model: MODEL };
  } catch (e) {
    throw new Error(formatGeminiError(e, apiKey));
  }
}
module.exports = {
  MODEL,
  generatePlan,
  checkKey,
  parsePlanResponse,
  formatGeminiError,
};
