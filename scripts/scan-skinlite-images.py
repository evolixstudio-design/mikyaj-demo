"""Read public catalog photos with local OCR. No catalog mutation; candidates require review."""
import json,re,sys,time,threading,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from rapidocr_onnxruntime import RapidOCR
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1];rows=json.loads((root/'.local-test-data/release-image-scan.json').read_text(encoding='utf-8-sig'))
output=root/'.local-test-data/skinlite-ocr.jsonl';cache=root/'.local-test-data/ocr-images';cache.mkdir(exist_ok=True)
done=set()
if output.exists():
 for line in output.read_text(encoding='utf-8').splitlines():
  try:
   r=json.loads(line)
   if not r.get('error'):done.add(r['id'])
  except ValueError:pass
local=threading.local()
def scan(p):
 try:
  url=(p.get('primary_image')or{}).get('url')
  if not url:return {'id':p['id'],'error':'missing image'}
  image=cache/(str(p['id'])+'.img')
  if not image.exists():
   req=urllib.request.Request(url.replace('/image/upload/','/image/upload/f_jpg,q_85,c_limit,w_800/'),headers={'User-Agent':'MikyajCatalogReview/1.0'})
   with urllib.request.urlopen(req,timeout=30) as response:image.write_bytes(response.read())
  if not hasattr(local,'engine'):local.engine=RapidOCR(intra_op_num_threads=1,inter_op_num_threads=1,det_limit_side_len=640)
  results,_=local.engine(image.read_bytes());texts=[x[1] for x in results or []];normal=re.sub('[^a-z]','', ' '.join(texts).lower())
  return {'id':p['id'],'product_id':p.get('product_id',p['id']),'slug':p['slug'],'texts':texts,'candidate':any(w in normal for w in ['skinlite','skinlight','skinlile','skinl1te'])}
 except Exception as e:return {'id':p['id'],'error':str(e)}
start=time.monotonic();count=0
with output.open('a',encoding='utf-8') as f,ThreadPoolExecutor(max_workers=8) as pool:
 for future in as_completed([pool.submit(scan,p) for p in rows if p['id']not in done]):
  r=future.result();f.write(json.dumps(r,ensure_ascii=False)+'\n');f.flush();count+=1
  if r.get('candidate'):print('CANDIDATE '+str(r['id'])+' '+str(r['texts']),flush=True)
  if count%100==0:print(json.dumps({'scanned':count+len(done),'total':len(rows),'seconds':round(time.monotonic()-start)}),flush=True)
print('OCR scan finished',flush=True)
