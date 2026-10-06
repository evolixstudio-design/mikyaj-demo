export function track(event,productId){
 if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl||location.pathname.startsWith('/admin'))return;
 try{let id=sessionStorage.getItem('mikyaj_visit');if(!id){id=crypto.randomUUID();sessionStorage.setItem('mikyaj_visit',id)}fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({session_id:id,event,path:location.pathname,product_id:productId,device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'})}).catch(()=>{})}catch{}
}
