import {useLayoutEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,X} from "@phosphor-icons/react";
type Step={view:"overview"|"accounts"|"wishlist"|"history"|"copilot"|"settings";tab?:string;target:string;title:string;body:string};
export const tourSteps:Step[]=[
 {view:"overview",target:".balance-card",title:"Start with your payday",body:"Allocate payday opens your plan. Enter the salary you actually received, choose the month, then enter your return fare and work weekdays. Transport uses that month's calendar. Nothing is transferred between banks."},
 {view:"overview",target:".allocation-card",title:"Give every amount a purpose",body:"This chart shows how your salary is split and what is left to allocate. Suggestions adapt to your pay. Review the figures before saving; each payday can only be saved once."},
 {view:"accounts",target:".bank-grid",title:"Your four money pockets",body:"Savings, commute and data, food, and lifestyle each have a breakdown. Open an account to see its split. The savings account also records borrowing and the amount you owe yourself. Account names can be changed in Settings."},
 {view:"wishlist",target:".wishlist-add",title:"Fund something you want",body:"Add a goal with its price, then contribute through your payday plan. Funded money carries forward. Mark an item bought when you purchase it; bought items are archived instead of repeating next month."},
 {view:"history",target:".history-layout",title:"Keep a record of your paydays",body:"History shows saved paydays, savings and recorded adjustments. The same monthly salary is fine: every payday is a separate record. You do not need to log every meal or journey."},
 {view:"copilot",target:".chat-header",title:"Talk through your plan",body:"The optional AI co-pilot can answer questions using your selected budget or suggest an allocation. A key is needed only for AI. Messages are sent when you choose Send, and proposed budgets wait for your review."},
 {view:"settings",tab:"currency",target:"#settings-panel-currency",title:"Choose your currency view",body:"Choose GHS, USD or GBP here. USD and GBP show converted estimates using dated rates you refresh or enter manually. Your original records and editable inputs stay in GHS, and saved rates work offline."},
 {view:"settings",tab:"backup",target:"#settings-panel-backup",title:"Keep a backup",body:"Export an encrypted copy of your records before a major change. Restore replaces the current records with that backup. Backups work under the same Windows account and never include your Gemini key."},
 {view:"settings",tab:"updates",target:"#settings-panel-updates",title:"Know when an update is ready",body:"Payday occasionally checks for updates while open. An Update badge appears on Settings when a new version is found. You choose when to download, restart and install; updates keep your saved records."},
 {view:"settings",tab:"reset",target:"#settings-panel-reset",title:"You control your data",body:"Reset asks for confirmation before clearing records and your AI key. Uninstall opens the Windows wizard; keep data deletion selected to remove saved files too. You can restart this tour anytime from Help & getting started."},
];
export default function GuidedTour({index,onNext,onBack,onClose}:{index:number;onNext:()=>void;onBack:()=>void;onClose:()=>void}){
 const step=tourSteps[index],dialog=useRef<HTMLDivElement>(null);
 const [layout,setLayout]=useState({left:20,top:100,width:0,height:0,popLeft:20,popTop:120});
 useLayoutEffect(()=>{
  const target=document.querySelector(step.target);
  target?.scrollIntoView({block:"center",behavior:"instant"});
  const position=()=>{
   const rect=target?.getBoundingClientRect();const pad=7,boxWidth=Math.min(380,window.innerWidth-32),boxHeight=dialog.current?.offsetHeight??300;
   const left=rect?Math.max(8,rect.left-pad):16,top=rect?Math.max(8,rect.top-pad):90;
   const width=rect?Math.min(rect.width+pad*2,window.innerWidth-left-8):0,height=rect?Math.min(rect.height+pad*2,window.innerHeight-top-8):0;
   const below=top+height+16,above=top-boxHeight-16;
   const popTop=below+boxHeight<window.innerHeight-16?below:above>16?above:Math.max(16,window.innerHeight-boxHeight-20);
   setLayout({left,top,width,height,popLeft:Math.max(16,Math.min(left,window.innerWidth-boxWidth-16)),popTop});
  };
  position();const frame=requestAnimationFrame(position);const observer=new ResizeObserver(position);if(target)observer.observe(target);
  window.addEventListener("resize",position);window.addEventListener("scroll",position,true);
  dialog.current?.querySelector<HTMLButtonElement>("[data-tour-next]")?.focus({preventScroll:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("resize",position);window.removeEventListener("scroll",position,true);};
 },[index,step.target]);
 return <div className="tour-layer">
  <div className="tour-spotlight" aria-hidden="true" style={{left:layout.left,top:layout.top,width:layout.width,height:layout.height}}/>
  <div ref={dialog} className="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" style={{left:layout.popLeft,top:layout.popTop}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();onClose();}if(e.key==="Tab"){const buttons=[...dialog.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
   <div className="tour-meta"><span>QUICK TOUR / {index+1} OF {tourSteps.length}</span><button className="icon-button" aria-label="Skip tour" onClick={onClose}><X size={18}/></button></div>
   <h2 id="tour-title">{step.title}</h2><p id="tour-description">{step.body}</p>
   <div className="tour-progress" aria-hidden="true"><i style={{width:`${((index+1)/tourSteps.length)*100}%`}}/></div>
   <div className="tour-actions"><button className="secondary" disabled={index===0} onClick={onBack}><ArrowLeft size={15}/>Back</button><button data-tour-next className="primary" onClick={onNext}>{index===tourSteps.length-1?"Finish tour":"Next"}<ArrowRight size={15}/></button></div>
  </div>
 </div>;
}
