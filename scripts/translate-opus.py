"""Free local OPUS-MT translation. Output is a review file, never a live DB write.
Model: Helsinki-NLP/opus-mt-tc-big-ar-en, CC BY 4.0.
Uses CTranslate2 int8 conversion for local CPU inference.
"""
import os, sys, json, hashlib, re, html
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
os.environ['HF_HOME'] = str(ROOT / '.translation-models' / 'huggingface')
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import ctranslate2
from transformers import AutoTokenizer
MODEL = 'Helsinki-NLP/opus-mt-tc-big-ar-en'
converted = ROOT / '.translation-models' / 'opus-ar-en-int8'
if not (converted / 'model.bin').exists():
    print('Downloading and converting the free OPUS-MT Arabic-English model...', flush=True)
    ctranslate2.converters.TransformersConverter(MODEL).convert(str(converted), quantization='int8', force=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL)
translator = ctranslate2.Translator(str(converted), device='cpu', compute_type='int8', intra_threads=4)
def translate_batch(texts):
    # Normalize explicit units, without changing the meaning of the source text.
    cleaned = [re.sub(r'(\d)\s*مل\b', r'\1 ml', html.unescape(t)) for t in texts]
    tokens = [tokenizer.convert_ids_to_tokens(tokenizer.encode(t)) for t in cleaned]
    results = translator.translate_batch(tokens, beam_size=4, max_decoding_length=512, max_input_length=512, repetition_penalty=1.1)
    return [html.unescape(tokenizer.decode(tokenizer.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True)) for r in results]
source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
if '--sample' in sys.argv:
    samples = source[:12]
    print(json.dumps([{'ar':p['name_ar'],'en':tr} for p,tr in zip(samples,translate_batch([p['name_ar'] for p in samples]))],ensure_ascii=False,indent=2))
    sys.exit(0)
destination=Path(sys.argv[2]);existing=json.loads(destination.read_text(encoding='utf-8')) if destination.exists() else []
done={(r['id'],r['source_hash']):r for r in existing};output=[]
cache_path=destination.with_suffix('.cache.json')
cache=json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
names=list(dict.fromkeys(p['name_ar'] for p in source if p.get('name_ar') and p['name_ar'] not in cache and len(tokenizer.encode(p['name_ar']))<400))
for batch_start in range(0,len(names),32):
    batch=names[batch_start:batch_start+32]
    cache.update(zip(batch,translate_batch(batch)))
    cache_path.parent.mkdir(parents=True,exist_ok=True)
    cache_path.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf-8')
    print(f'Names: {min(batch_start+32,len(names))}/{len(names)}',flush=True)

for i,p in enumerate(source):
    texts=[p.get(k) or '' for k in ['name_ar','short_description_ar','details_ar']]
    digest=hashlib.sha256(json.dumps(texts,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    if (p['id'],digest) in done:output.append(done[(p['id'],digest)]);continue
    result={'id':p['id'],'source_hash':digest,'translation_model':MODEL}
    for key,text in zip(['name_en','short_description_en','details_en'],texts):
        if not text:result[key]='';continue
        if text not in cache:
            # Split long text before tokenization so input is never silently truncated.
            parts=[]
            for paragraph in text.splitlines():
                if not paragraph.strip():parts.append('');continue
                words=paragraph.split();chunk=[]
                for word in words:
                    if len(tokenizer.encode(' '.join(chunk+[word])))>400 and chunk:parts.append(' '.join(chunk));chunk=[]
                    chunk.append(word)
                if chunk:parts.append(' '.join(chunk))
            nonempty=[v for v in parts if v];translated=[]
            for j in range(0,len(nonempty),16):translated.extend(translate_batch(nonempty[j:j+16]))
            it=iter(translated);cache[text]='\n'.join(next(it) if part else '' for part in parts)
        result[key]=cache[text]
    output.append(result)
    destination.parent.mkdir(parents=True,exist_ok=True);tmp=destination.with_suffix('.tmp');tmp.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(destination)
    if i%25==0:print(f'{i+1}/{len(source)} translated',flush=True)
destination.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8');print(f'Completed {len(output)} draft translations.',flush=True)
