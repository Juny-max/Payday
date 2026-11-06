require('./desktop-harness.cjs');
const service=require('../electron/gemini.cjs');
// Isolated UI test doubles: no real credential or Google request.
service.checkKey=async()=>({model:service.MODEL});
service.generatePlan=async({prompt,current,appContext})=>{if(prompt.includes("build my budget")){await new Promise(resolve=>setTimeout(resolve,1800));return {reply:"Please tell me your take-home salary so we can plan."};}if(prompt.includes("saved budget")) return {reply:`Selected salary: ${current.salary}; savings balance: ${appContext?.savingsBalance}`};if(prompt.includes('yo')) { await new Promise(resolve=>setTimeout(resolve,900)); return {reply:'Hello! Tell me what you would like to plan.'}; } throw new Error('Gemini quota or rate limit reached (429). Check the API project quota/billing.');};
