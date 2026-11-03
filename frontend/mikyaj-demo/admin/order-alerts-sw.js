// Notification-only worker. Never caches customer pages, credentials or API responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data.json()}catch{data={title:'Mikyaj order update',body:'Open admin to view your orders.'}}
 const url=typeof data.url==='string'&&data.url.startsWith('/admin/manage.html')?data.url:'/admin/manage.html?view=orders';
 event.waitUntil(self.registration.showNotification(data.title||'Mikyaj order update',{body:data.body||'Open admin to view the order.',icon:'/favicon-192.png',badge:'/favicon-96.png',tag:data.tag||'mikyaj-order',renotify:true,requireInteraction:true,vibrate:[200,100,200],data:{url}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=new URL(event.notification.data?.url||'/admin/manage.html?view=orders',self.location.origin);if(target.origin!==self.location.origin)return;const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});const admin=tabs.find(t=>new URL(t.url).pathname.startsWith('/admin/'));if(admin){await admin.navigate(target.href);return admin.focus()}return self.clients.openWindow(target.href)})())});
