const {exchangeRatesSchema}=require('./model.cjs');
async function fetchRates(request=fetch) {
 const response=await request('https://api.frankfurter.dev/v2/rates?base=GHS&quotes=USD,GBP',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Exchange rates are unavailable. Your saved rates have been kept.');
 const rows=await response.json();
 if(!Array.isArray(rows))throw new Error('Invalid exchange-rate reply.');
 const usd=rows.find(r=>r.base==='GHS' && r.quote==='USD');
 const gbp=rows.find(r=>r.base==='GHS' && r.quote==='GBP');
 return exchangeRatesSchema.parse({USD:usd?.rate,GBP:gbp?.rate,asOf:[usd?.date,gbp?.date].sort()[0],fetchedAt:new Date().toISOString(),source:'Frankfurter'});
}
module.exports={fetchRates};
