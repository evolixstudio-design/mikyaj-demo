"""Resume missing descriptions using local OPUS models; never load production .env.

Input: admin translation export. Output: resumable JSONL in a user-specified file.
Existing English text is preserved. Import uses the normal source-hash guarded API.
"""
import sys, json, os, hashlib, re, time
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
os.environ['TOKENIZERS_PARALLELISM']='false'
import ctranslate2
from transformers import AutoTokenizer

source=Path(sys.argv[1]); destination=Path(sys.argv[2])
rows=json.loads(source.read_text(encoding='utf-8-sig'))
model=ROOT/'.translation-models/opus-ar-en-int8'
tokenizer=AutoTokenizer.from_pretrained(str(model/'tokenizer'),local_files_only=True)
translator=ctranslate2.Translator(str(model),device='cpu',compute_type='int8',intra_threads=4)
destination.parent.mkdir(parents=True,exist_ok=True)
cache_path=destination.with_suffix('.cache.jsonl');cache={}
if cache_path.exists():
    for line in cache_path.read_text(encoding='utf-8').splitlines():
        try:
            item=json.loads(line);cache[item['source']]=item['translation']
        except ValueError: pass
done=set()
if destination.exists():
    for line in destination.read_text(encoding='utf-8').splitlines():
        try:
            item=json.loads(line);done.add((item['id'],item['source_hash']))
        except ValueError: pass

def translate(text):
    if not text or not re.search('[\u0600-\u06ff]',text): return text
    if text in cache: return cache[text]
    parts=[]
    for paragraph in text.splitlines():
        if not paragraph.strip():parts.append('');continue
        chunk=[]
        for word in paragraph.split():
            if len(tokenizer.encode(' '.join(chunk+[word])))>350 and chunk:
                parts.append(' '.join(chunk));chunk=[]
            chunk.append(word)
        if chunk:parts.append(' '.join(chunk))
    tokens=[tokenizer.convert_ids_to_tokens(tokenizer.encode(p)) for p in parts if p]
    results=translator.translate_batch(tokens,beam_size=2,max_input_length=512,max_decoding_length=700,repetition_penalty=1.1,max_batch_size=16)
    values=iter(tokenizer.decode(tokenizer.convert_tokens_to_ids(r.hypotheses[0]),skip_special_tokens=True) for r in results)
    output='\n'.join(next(values) if p else '' for p in parts)
    cache[text]=output
    with cache_path.open('a',encoding='utf-8') as f:f.write(json.dumps({'source':text,'translation':output},ensure_ascii=False)+'\n')
    return output

started=time.monotonic();count=0
with destination.open('a',encoding='utf-8') as f:
    # First fulfill newest products, which are commonly opened from the admin.
    for p in reversed(rows):
        if (p['id'],p['source_hash']) in done:continue
        result={k:p[k] for k in ['id','source_hash']}
        for key in ['name','short_description','details']:
            result[key+'_en']=p.get(key+'_en') or translate(p.get(key+'_ar') or '')
        f.write(json.dumps(result,ensure_ascii=False)+'\n');f.flush();count+=1
        if count%10==0:print(json.dumps({'completed':len(done)+count,'total':len(rows),'seconds':round(time.monotonic()-started)}),flush=True)
print('Translation export complete.',flush=True)
