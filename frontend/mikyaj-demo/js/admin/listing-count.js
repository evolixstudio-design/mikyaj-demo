import {$,esc,manage,link,panel,content,toast,download,select,field} from './core.js';

const inr=paise=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(paise)/100);
export function listingMetrics(data){const s=data.summary;return `<div class="stats-grid listing-count-metrics">${panel('Billable new listings',`<strong class="stat">${s.billable_listings}</strong>`)}${panel('Rate per new listing',`<strong class="stat">${inr(data.settings.rate_paise)}</strong>`)}${panel('Listing work total',`<strong class="stat">${inr(s.amount_paise)}</strong>`)}</div>`;}

export async function listingCount(){
 const initial=new URLSearchParams(location.search);
 let offset=0,generation=0,active={period:initial.get('period')||((initial.get('from')||initial.get('to'))?'custom':'this-month')};
 if(active.period==='custom'){active.from=initial.get('from')||'';active.to=initial.get('to')||'';}
 content(`${panel('Billing period',`<form id="listing-period-filter" class="listing-period-filter">${select('Period','period',[['this-month','This month'],['last-month','Last month'],['7d','Last 7 days'],['14d','Last 2 weeks'],['1m','Last 1 month'],['3m','Last 3 months'],['custom','Custom dates'],['all','All history']],active.period)}${field('From','from',active.from||'','date','required')}${field('To','to',active.to||'','date','required')}<button type="submit" class="button secondary">Apply dates</button></form><p class="small muted" id="listing-period-label">Dates use Kuwait time. Choose the dates for the bill you are preparing.</p>`)}<div id="listing-count-summary"></div>${panel('Listing history',`<p class="muted">Counts each successfully created product once, including new imports and drafts. The original catalogue is excluded. Editing, republishing, moving categories or changing stock does not add a listing. Deleted listings remain in this work history.</p><p class="small muted">Amounts are listing-work charges in Indian rupees (INR), separate from customer order totals in Kuwaiti dinars.</p><div class="admin-page-actions"><button class="button secondary" id="export-listings">Export selected period</button></div><div id="listing-count-table" aria-live="polite">Loading listings…</div><div class="table-pagination"><span id="listing-count-range"></span><div><button class="button secondary" id="previous-listings">Previous</button><button class="button secondary" id="next-listings">Next</button></div></div>`)}`);
 const form=$('#listing-period-filter');
 const datesEnabled=()=>{const custom=form.elements.period.value==='custom';form.elements.from.disabled=!custom;form.elements.to.disabled=!custom;};
 datesEnabled();
 function filters(){const period=form.elements.period.value;return period==='custom'?{period,from:form.elements.from.value,to:form.elements.to.value}:{period};}
 async function load(){
  const ticket=++generation;
  $('#previous-listings').disabled=true;$('#next-listings').disabled=true;
  try{
   const d=await manage('/listing-count?'+new URLSearchParams({...active,limit:50,offset}));if(ticket!==generation)return;
   const lifetime=d.all_time_summary||d.summary;
   $('#listing-count-summary').innerHTML=listingMetrics(d)+`<p class="small muted">Selected period: ${d.summary.admin_created} admin-created · ${d.summary.imported_new} new catalogue imports${d.summary.other_new?' · '+d.summary.other_new+' other new listings':''}. All history retained: <strong>${lifetime.billable_listings} billable listings · ${inr(lifetime.amount_paise)}</strong>.</p>`;
   const window=d.window;
   $('#listing-period-label').textContent=window?.from?`${window.from} to ${window.to}, inclusive. Dates use Kuwait time. Counts, charges and export use this same period.`:'All recorded listing history. No records are reset or deleted.';
   if(window?.from&&active.period!=='custom'){form.elements.from.value=window.from;form.elements.to.value=window.to;}
   $('#listing-count-table').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Product</th><th>Added (Kuwait time)</th><th>Source</th><th>Listing rate</th></tr></thead><tbody>${d.rows.map(r=>`<tr><td>${r.slug&&!r.deleted_at?`<a href="${link('product',{id:r.product_reference})}">${esc(r.current_name_en||r.current_name_ar)}</a>`:esc(r.name_en||r.name_ar)}<small>Product #${r.product_reference}${r.deleted_at||!r.slug?' · Removed from store':''}</small></td><td>${new Date(r.listed_at).toLocaleString('en-GB',{timeZone:'Asia/Kuwait'})}</td><td>${r.source==='ADMIN'?'Admin panel':r.source==='SUPPLIER_IMPORT'?'Catalogue import':'New product'}</td><td>${r.billable?inr(r.rate_paise):'Excluded'}</td></tr>`).join('')||'<tr><td colspan="4">No new listings in this period.</td></tr>'}</tbody></table></div>`;
   $('#listing-count-range').textContent=`${d.summary.tracked_listings?offset+1:0}–${offset+d.rows.length} of ${d.summary.tracked_listings}`;
   $('#previous-listings').disabled=!offset;$('#next-listings').disabled=d.next_offset===null;
   history.replaceState(null,'',link('listing-count',active));
  }catch(e){toast(e.message);}
 }
 const apply=()=>{if(!form.reportValidity())return;const next=filters();if(next.from&&next.from>next.to){toast('The start date must be on or before the end date.');return;}active=next;offset=0;load();};
 form.onsubmit=e=>{e.preventDefault();apply();};
 form.elements.period.onchange=()=>{datesEnabled();if(form.elements.period.value!=='custom')apply();};
 $('#previous-listings').onclick=()=>{offset=Math.max(0,offset-50);load();};
 $('#next-listings').onclick=()=>{offset+=50;load();};
 $('#export-listings').onclick=async e=>{
  e.target.disabled=true;
  try{
   const selected={...active};let next=0,rows=[];
   do{const d=await manage('/listing-count?'+new URLSearchParams({...selected,limit:500,offset:next}));rows.push(...d.rows);next=d.next_offset;}while(next!==null);
   const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';
   const csv=[['Product ID','Product name','Added UTC','Source','Billable','Rate INR'],...rows.map(r=>[r.product_reference,r.current_name_en||r.current_name_ar||r.name_en||r.name_ar,r.listed_at,r.source,r.billable?'Yes':'No',(r.rate_paise/100).toFixed(2)])].map(row=>row.map(cell).join(',')).join('\r\n');
   const suffix=selected.period==='custom'?selected.from+'-to-'+selected.to:selected.period;
   download('\ufeff'+csv,'mikyaj-listing-work-'+suffix+'.csv');
  }catch(error){toast(error.message);}finally{e.target.disabled=false;}
 };
 await load();
}
