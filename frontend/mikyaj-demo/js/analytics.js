const viewId=crypto.randomUUID();
export function track(event,productId,durationMs=0){
 if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl||location.pathname.startsWith('/admin'))return;
 try{let id=sessionStorage.getItem('mikyaj_visit');if(!id){id=crypto.randomUUID();sessionStorage.setItem('mikyaj_visit',id)}fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({session_id:id,view_id:viewId,duration_ms:Math.min(86400000,Math.round(durationMs)),event,path:location.pathname,product_id:productId,device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'})}).catch(()=>{})}catch{}
}
let started=false;
export function startDwell(){if(started)return;started=true;let elapsed=0,last=performance.now(),active=document.visibilityState==='visible';const sample=()=>{const now=performance.now();if(active)elapsed+=Math.min(now-last,30000);last=now};const send=()=>{sample();if(elapsed>0)track('page_dwell',undefined,elapsed)};setInterval(send,15000);document.addEventListener('visibilitychange',()=>{send();active=document.visibilityState==='visible';last=performance.now()});window.addEventListener('pagehide',send)}
