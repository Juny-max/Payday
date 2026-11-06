const STARTUP_DELAY = 20_000;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
function createUpdateScheduler({enabled,updates,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let running=false,timer=null,nextAt=0;
 function schedule() {
  if(!running)return;
  if(timer!==null)clearTimer(timer);
  timer=setTimer(()=>{void tick();},Math.max(0,nextAt-now()));
  timer?.unref?.();
 }
 async function tick() {
  if(!running)return;
  if(now()<nextAt){schedule();return;}
  // Advance first so focus/resume events cannot cause a burst of requests.
  nextAt=now()+CHECK_INTERVAL;
  try {await updates.check({quiet:true});}catch{/* Background errors never interrupt budgeting. */}
  finally{schedule();}
 }
 return {
  start(){if(!enabled||running)return;running=true;nextAt=now()+STARTUP_DELAY;schedule();},
  wake(){if(running)void tick();},
  stop(){running=false;if(timer!==null)clearTimer(timer);timer=null;},
 };
}
module.exports={createUpdateScheduler,STARTUP_DELAY,CHECK_INTERVAL};
