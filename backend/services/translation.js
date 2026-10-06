const {getSecret}=require('./commerce-settings');
async function translate(text,source,target){
 if(!['ar','en'].includes(source)||!['ar','en'].includes(target)||source===target||typeof text!=='string'||!text.trim()||text.length>10000)throw Object.assign(new Error('Choose Arabic or English and text up to 10,000 characters.'),{status:400});
 const url=process.env.TRANSLATION_URL,key=await getSecret('GOOGLE_TRANSLATE_API_KEY');
 if(!url&&!key)throw Object.assign(new Error('Automatic translation needs a private translation service (TRANSLATION_URL). Your original text is preserved; enter the translation manually for now.'),{status:503,expose:true});
 const response=await fetch(url?url.replace(/\/$/,'')+'/translate':'https://translation.googleapis.com/language/translate/v2',{method:'POST',headers:{'Content-Type':'application/json',...(!url?{'X-goog-api-key':key}:{})},body:JSON.stringify({q:text,source,target,format:'text',...(url&&process.env.TRANSLATION_API_KEY?{api_key:process.env.TRANSLATION_API_KEY}:{})}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Object.assign(new Error('Translation service is unavailable. Your original text has been preserved.'),{status:503,expose:true});
 const data=await response.json(),translated=url?data.translatedText:data.data?.translations?.[0]?.translatedText;
 if(typeof translated!=='string'||!translated.trim())throw Object.assign(new Error('The translation service returned no text.'),{status:502});
 return translated;
}
module.exports={translate};
