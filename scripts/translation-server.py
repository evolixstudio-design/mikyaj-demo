"""Local, free OPUS-MT service with a LibreTranslate-compatible /translate endpoint.

Prepare once: .translation-venv/Scripts/python.exe scripts/translation-server.py --prepare
Run:         .translation-venv/Scripts/python.exe scripts/translation-server.py
Backend:     TRANSLATION_URL=http://127.0.0.1:8765
The service binds only to loopback and rejects browser-originated requests.
Model attribution and licenses: docs/TRANSLATION-SERVICE.md.
"""
import os
import json
import sys
import re
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = Path(__file__).resolve().parents[1]
os.environ['HF_HOME'] = str(ROOT / '.translation-models' / 'huggingface')
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import ctranslate2
from transformers import AutoTokenizer

MODELS = {'ar': ('Helsinki-NLP/opus-mt-tc-big-ar-en', 'opus-ar-en-int8'),
          'en': ('Helsinki-NLP/opus-mt-en-ar', 'opus-en-ar-int8')}
engines = {}

def prepare():
    for model, directory in MODELS.values():
        destination = ROOT / '.translation-models' / directory
        if not (destination / 'model.bin').exists():
            print('Preparing ' + model, flush=True)
            ctranslate2.converters.TransformersConverter(model).convert(str(destination), quantization='int8')
        tokenizer = AutoTokenizer.from_pretrained(model)
        tokenizer.save_pretrained(str(destination / 'tokenizer'))
    print('Both translation directions are prepared.', flush=True)

def engine(source):
    if source not in engines:
        model, directory = MODELS[source]
        destination = ROOT / '.translation-models' / directory
        tokenizer_dir = destination / 'tokenizer'
        tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_dir) if tokenizer_dir.exists() else model, local_files_only=True)
        translator = ctranslate2.Translator(str(destination), device='cpu', compute_type='int8', intra_threads=4)
        engines[source] = tokenizer, translator
    return engines[source]

def translate(text, source):
    tokenizer, translator = engine(source)
    parts = []
    # Split by token count so long product descriptions are not silently truncated.
    for paragraph in text.splitlines():
        if not paragraph.strip():
            parts.append('')
            continue
        chunk = []
        for word in paragraph.split():
            if len(tokenizer.encode(' '.join(chunk + [word]))) > 380 and chunk:
                parts.append(' '.join(chunk)); chunk = []
            chunk.append(word)
        if chunk:
            parts.append(' '.join(chunk))
    nonempty = [p for p in parts if p]
    prefix = '>>ara<< ' if source == 'en' else ''
    tokens = [tokenizer.convert_ids_to_tokens(tokenizer.encode(prefix + p)) for p in nonempty]
    results = translator.translate_batch(tokens, beam_size=3, max_input_length=512, max_decoding_length=512, repetition_penalty=1.1)
    translated = iter(tokenizer.decode(tokenizer.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True) for r in results)
    return '\n'.join(next(translated) if p else '' for p in parts)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log submitted content.

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'ready': list(engines)})

    def do_POST(self):
        if self.path != '/translate' or self.headers.get('Origin'):
            return self.reply(403, {'error': 'Server requests only'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 80000:
                return self.reply(413, {'error': 'Text too long'})
            data = json.loads(self.rfile.read(length))
            text, source, target = data.get('q'), data.get('source'), data.get('target')
            if not isinstance(text, str) or not text.strip() or len(text) > 10000 or source not in MODELS or target != ('en' if source == 'ar' else 'ar'):
                return self.reply(400, {'error': 'Invalid translation request'})
            self.reply(200, {'translatedText': translate(text, source)})
        except Exception as error:
            print('Translation failed: ' + type(error).__name__, flush=True)
            self.reply(503, {'error': 'Local model unavailable'})

if __name__ == '__main__':
    if '--prepare' in sys.argv:
        prepare()
    else:
        for source in MODELS:
            engine(source)
        print('Translation service ready on http://127.0.0.1:8765', flush=True)
        HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
