const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markup(general={},lang='en'){const number=String(general.commercial_registration_number||'').trim();return number?`<p class="commercial-registration small">${lang==='ar'?'رقم السجل التجاري':'Commercial Registration Number'}: <bdi>${escape(number)}</bdi></p>`:''}
module.exports={markup};
