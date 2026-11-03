import {$,api,t,url,toast} from './ui.js';
let library;
export async function setupGoogle(target,onSuccess){
 if(!target)return;try{
  const config=await api('/customer/google/config');if(!config.enabled)return;
  library ||= new Promise((resolve,reject)=>{if(window.google?.accounts?.id)return resolve();const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in could not load. Use email and password.'));document.head.append(script)});
  await library;
  target.innerHTML='<p class="small">'+t('Sign in securely with Google','سجلي الدخول بأمان عبر جوجل')+'</p><div data-google-button></div><p class="small" data-google-status role="alert"></p>';
  google.accounts.id.initialize({client_id:config.client_id,nonce:config.nonce,auto_select:false,callback:async result=>{try{await api('/customer/google',{method:'POST',body:{credential:result.credential,nonce:config.nonce}});await onSuccess()}catch(e){$('[data-google-status]',target).textContent=e.message;const retry=document.createElement('button');retry.className='text-button';retry.type='button';retry.textContent=t('Try Google again','حاولي مجدداً عبر جوجل');retry.onclick=()=>setupGoogle(target,onSuccess);target.append(retry)}}});
  google.accounts.id.renderButton($('[data-google-button]',target),{theme:'outline',size:'large',text:'continue_with',locale:document.documentElement.lang==='ar'?'ar':'en',width:270});
 }catch(e){target.textContent=t('Google sign-in is unavailable. Use email and password.','تسجيل الدخول عبر جوجل غير متاح. استخدمي البريد الإلكتروني وكلمة المرور.')}
}
