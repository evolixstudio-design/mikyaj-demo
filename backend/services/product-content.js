// Extract only explicitly labelled directions; never invent product-specific usage.
const usageHeading = /^(?:#{1,6}\s*)?(?:\*\*)?(?:how to use|how to apply|method of use|method of application|usage method|recommended use|suggested use|directions(?: for use)?|usage(?: instructions)?|instructions for use|طريقة\s*(?:الاستخدام|الإستخدام|الاستعمال|الإستعمال|الأستعمال|استخدام|استعمال)|كيفية\s*(?:الاستخدام|الإستخدام|الاستعمال|الإستعمال|الأستعمال|استخدام|استعمال)|الاستخدام المقترح|الاستخدام الموصى به|إرشادات الاستخدام|تعليمات الاستخدام)(?:\*\*)?\s*[:：\-–]?\s*(.*)$/i;
const nextHeading = /^(?:#{1,6}\s*)?(?:\*\*)?(?:ingredients|components|composition|cautions?|notes|quantity|size|brand|warnings?|precautions?|benefits|features|storage|product description|المكونات|تحذيرات|التحذيرات|احتياطات|فوائد|الفوائد|مميزات|المميزات|التخزين|ملاحظات|تنبيهات|المواصفات|الحجم|الكمية|وصف المنتج)(?:\*\*)?\s*[:：]?/i;
function splitUsage(value) {
 const lines=String(value||'').split(/\r?\n/),details=[],usage=[];let inUsage=false;
 for(const line of lines){const heading=line.trim().replace(/^[^\p{L}\p{N}#*]+/u,'');const match=heading.match(usageHeading);if(match){inUsage=true;if(match[1])usage.push(match[1]);continue}if(inUsage&&nextHeading.test(heading))inUsage=false;(inUsage?usage:details).push(line)}
 return {details:details.join('\n').trim(),usage:usage.join('\n').trim()};
}
function contentSections(product) {
 const sections={};
 for(const lang of ['en','ar']){const details=splitUsage(product['details_'+lang]),short=splitUsage(product['short_description_'+lang]);sections[lang]={description:short.details,details:details.details,how_to_use:product['how_to_use_'+lang]||details.usage||short.usage||'',has_directions:Boolean(product['how_to_use_'+lang]||details.usage||short.usage)};}
 return sections;
}
module.exports={splitUsage,contentSections};
