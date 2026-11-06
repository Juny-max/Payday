require('./desktop-harness.cjs');
const service=require('../electron/updates.cjs');
service.createUpdateService=({notify})=>{
 let state={status:'idle',currentVersion:'1.4.7',version:'',percent:0,message:'Check for a new version when you are ready.'};
 const set=value=>{state={...state,...value};notify(state);return state;};
 return {get:()=>state,check:async()=>set({status:'available',version:'1.4.8',message:'Payday 1.4.8 is available.'}),download:async()=>{set({status:'downloading',percent:50,message:'Downloading your update...'});await new Promise(r=>setTimeout(r,700));return set({status:'ready',percent:100,message:'Your update is ready. Restart when you are ready to install.'});},install:async()=>set({status:'installing',message:'Restarting to install your update...'})};
};
