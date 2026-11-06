import {createContext,useContext,useState,useMemo,type ReactNode} from "react";
import {ArrowsClockwise,Globe,Check} from "@phosphor-icons/react";
import {cash as baseCash,displayAmount,exchangeRatesSchema,type Currency,type ExchangeRates} from "./model";
const labels={GHS:"Ghana cedi",USD:"US dollar",GBP:"British pound"};
const symbols={GHS:"GH\u20b5",USD:"$",GBP:"\u00a3"};
const defaults={currency:"GHS" as Currency,label:labels.GHS,symbol:symbols.GHS,cash:baseCash,number:(n:number)=>n};
const CurrencyContext=createContext(defaults);
export const useCurrency=()=>useContext(CurrencyContext);
export function currencyPresentation(currency:Currency,rates?:ExchangeRates) {
  const effective=currency!=="GHS" && !rates ? "GHS" : currency;
  const number=(n:number)=>displayAmount(n,effective,rates);
  return {currency:effective,label:labels[effective],symbol:symbols[effective],number,cash:(n:number)=>`${symbols[effective]} ${number(n).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}`};
}
export function CurrencyProvider({currency,rates,children}:{currency:Currency;rates?:ExchangeRates;children:ReactNode}) {
 const value=useMemo(()=>currencyPresentation(currency,rates),[currency,rates]);
 return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
export function CurrencySettings({currency,rates,disabled,onSave}:{currency:Currency;rates?:ExchangeRates;disabled:boolean;onSave:(currency:Currency,rates?:ExchangeRates)=>Promise<boolean>}) {
 const [choice,setChoice]=useState(currency),[draftRates,setDraftRates]=useState(rates),[usd,setUsd]=useState(rates?.USD??0),[gbp,setGbp]=useState(rates?.GBP??0),[date,setDate]=useState(rates?.asOf??new Date().toISOString().slice(0,10)),[loading,setLoading]=useState(false),[error,setError]=useState(""),[manual,setManual]=useState(false);
 async function refresh(){if(!window.payday)return;setLoading(true);setError("");try {const fetched=exchangeRatesSchema.parse(await window.payday.exchangeRates());if(await onSave(choice,fetched)){setDraftRates(fetched);setUsd(fetched.USD);setGbp(fetched.GBP);setDate(fetched.asOf);setManual(false);}}catch{setError("Could not refresh rates. Your saved rates are unchanged. Enter rates manually to use this offline.");}finally{setLoading(false);}}
 return <section className="setting-section" role="tabpanel" id="settings-panel-currency" aria-labelledby="settings-tab-currency">
  <div className="setting-title"><Globe size={22}/><div><h2>Currency & conversion</h2><p>Choose how your budget amounts are displayed.</p></div></div>
  <label className="field"><span>Preferred currency</span><select aria-label="Preferred currency" value={choice} disabled={disabled||loading} onChange={async e=>{const next=e.target.value as Currency;setChoice(next);setError("");if(next==="GHS"||draftRates){if(!await onSave(next,draftRates))setChoice(currency);}}}>{Object.entries(labels).map(([code,label])=><option key={code} value={code}>{code} - {label}</option>)}</select></label>
  <p className="settings-note">Your original records and input fields remain in GHS. USD and GBP are converted viewing amounts, not new accounts or bank transfers. Notes and chat retain their original currency.</p>
  {choice!=="GHS" && !draftRates && <p className="currency-warning" role="status">Add exchange rates below to activate {choice}. Until then, amounts stay in GHS.</p>}
  {draftRates && <div className="rate-summary"><strong>1 GHS = {draftRates.USD} USD / {draftRates.GBP} GBP</strong><p>{draftRates.source} rates dated {draftRates.asOf}. Cached for offline use.</p><p>Estimates only. Bank rates and fees may differ. Saved rates do not refresh automatically.</p></div>}
  <div className="button-row"><button className="secondary" disabled={!window.payday||disabled||loading} onClick={()=>void refresh()}><ArrowsClockwise size={16} className={loading?"spin":""}/>{loading?"Refreshing rates...":"Refresh exchange rates"}</button><button className="secondary" disabled={disabled||loading} onClick={()=>setManual(!manual)} aria-expanded={manual}>Enter rates manually</button></div>
  <p className="settings-note">Refreshing contacts Frankfurter for GHS/USD/GBP rates only. Your salary, records and API key are not sent.</p>
  {error && <p className="danger-text" role="alert">{error}</p>}
  {manual && <div className="manual-rates"><label className="field"><span>USD per 1 GHS</span><input aria-label="USD per 1 GHS" type="number" min="0.000001" step="0.000001" value={usd} onChange={e=>setUsd(Number(e.target.value))}/></label><label className="field"><span>GBP per 1 GHS</span><input aria-label="GBP per 1 GHS" type="number" min="0.000001" step="0.000001" value={gbp} onChange={e=>setGbp(Number(e.target.value))}/></label><label className="field"><span>Rate date</span><input aria-label="Rate date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary" disabled={disabled||loading||!(usd>0)||!(gbp>0)||!date} onClick={async()=>{try{const saved=exchangeRatesSchema.parse({USD:usd,GBP:gbp,asOf:date,fetchedAt:new Date().toISOString(),source:"Manual"});if(await onSave(choice,saved)){setDraftRates(saved);setError("");setManual(false);}}catch{setError("Enter valid positive exchange rates and a date.");}}}><Check size={16}/>Save rates and currency</button></div>}
 </section>;
}
