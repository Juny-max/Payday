require('./desktop-harness.cjs');
require('../electron/updates.cjs').createUpdateService=({notify})=>{
 let state={status:'idle',currentVersion:'1.5.3',version:'',percent:0,message:'Check for a new version when you are ready.'};
 const set=value=>{state={...state,...value};notify(state);return state;};
 setTimeout(()=>set({status:'available',version:'1.5.4',message:'Payday 1.5.4 is available.'}),1200);
 return {get:()=>state,check:async()=>set({status:'current',version:'',message:'You are using the latest published Payday version.'}),download:async()=>{set({status:'downloading',percent:50,message:'Downloading your update...'});await new Promise(r=>setTimeout(r,500));return set({status:'ready',percent:100,message:'Your update is ready. Restart when you are ready to install.'});},install:async()=>state};
};
