const express=require('express');
const {pipeline}=require('node:stream/promises');
const {GetObjectCommand,HeadObjectCommand}=require('@aws-sdk/client-s3');
const storage=require('../services/media-storage');

// Only processed catalogue images are public. Bucket listings, originals and evidence are inaccessible.
function createMediaRouter({getStorage=storage.config}={}){
  const router=express.Router();let target;
  router.use(async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method))return res.set('Allow','GET, HEAD').sendStatus(405);
    if(!/^\/(?:product|category|brand|content|migration)\/[a-z0-9-]{1,80}\/image(?:-w(?:240|480|800))?\.webp$/.test(req.path))return res.sendStatus(404);
    const controller=new AbortController(),abort=()=>controller.abort();
    req.once('aborted',abort);res.once('close',()=>{if(!res.writableFinished)abort();});
    try{
      target ||= getStorage();
      const input={Bucket:target.bucket,Key:'mikyaj/v1'+req.path};
      const object=await target.client.send(req.method==='HEAD'?new HeadObjectCommand(input):new GetObjectCommand(input),{abortSignal:controller.signal});
      if(object.ContentType!=='image/webp'||!Number.isSafeInteger(Number(object.ContentLength))||Number(object.ContentLength)<=0||Number(object.ContentLength)>25*1024*1024){object.Body?.destroy?.();throw Object.assign(new Error('Invalid public image'),{status:502});}
      res.set({'Content-Type':'image/webp','Content-Length':String(object.ContentLength),'Cache-Control':'public, max-age=31536000, immutable','Netlify-CDN-Cache-Control':'public, max-age=31536000','X-Content-Type-Options':'nosniff','Accept-Ranges':'none'});
      if(object.ETag)res.set('ETag',object.ETag);
      if(object.LastModified)res.set('Last-Modified',new Date(object.LastModified).toUTCString());
      if(object.ETag&&req.headers['if-none-match']?.split(',').map(v=>v.trim()).includes(object.ETag)){object.Body?.destroy?.();return res.status(304).end();}
      if(req.method==='HEAD')return res.end();
      await pipeline(object.Body,res);
    }catch(error){
      if(controller.signal.aborted)return;
      if(res.headersSent)return next(error);
      for(const header of ['Content-Length','ETag','Last-Modified','Netlify-CDN-Cache-Control'])res.removeHeader(header);
      res.set('Cache-Control','no-store');
      const missing=error.name==='NoSuchKey'||error.name==='NotFound'||error.$metadata?.httpStatusCode===404;
      res.status(missing?404:503).type('text/plain').send(missing?'Image not found.':'Image temporarily unavailable.');
    }finally{req.removeListener('aborted',abort);}
  });return router;
}
module.exports=createMediaRouter();
module.exports.createMediaRouter=createMediaRouter;
