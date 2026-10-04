import {$,lang} from './ui.js';
export function renderPolicy(){const data=JSON.parse($('#initialData')?.textContent||'{}');if(data.policy?.[lang])$('main').innerHTML=data.policy[lang]}
