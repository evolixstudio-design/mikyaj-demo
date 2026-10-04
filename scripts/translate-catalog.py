"""Free, resumable offline Arabic -> English translation; produces reviewable JSON.
Usage: .translation-venv/Scripts/python scripts/translate-catalog.py input.json output.json
Arabic source fields are never changed. The first run downloads the open Argos model.
"""
import os, sys, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.environ['ARGOS_PACKAGE_DIR'] = str(ROOT / '.translation-models' / 'packages')
os.environ['XDG_DATA_HOME'] = str(ROOT / '.translation-models' / 'data')
os.environ['XDG_CACHE_HOME'] = str(ROOT / '.translation-models' / 'cache')
os.environ['ARGOS_DEVICE_TYPE'] = 'cpu'
os.environ['ARGOS_INTER_THREADS'] = '2'
os.environ['ARGOS_INTRA_THREADS'] = '4'
import argostranslate.package
import argostranslate.translate

def engine():
    installed = argostranslate.package.get_installed_packages()
    if not any(p.from_code == 'ar' and p.to_code == 'en' for p in installed):
        print('Downloading the free Arabic-English model...', flush=True)
        argostranslate.package.update_package_index()
        package = next(p for p in argostranslate.package.get_available_packages() if p.from_code == 'ar' and p.to_code == 'en')
        argostranslate.package.install_from_path(package.download())
    return argostranslate.translate.get_translation_from_codes('ar', 'en')

def main():
    translator = engine()
    if len(sys.argv) < 3:
        print(translator.translate('أحمر شفاه مرطب باللون الوردي'), flush=True)
        return
    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    records = json.loads(source.read_text(encoding='utf-8-sig'))
    existing = json.loads(destination.read_text(encoding='utf-8')) if destination.exists() else []
    completed = {(p['id'], p['source_hash']): p for p in existing}
    cache = {}
    output = []
    for index, p in enumerate(records):
        arabic = [p.get(k) or '' for k in ('name_ar', 'short_description_ar', 'details_ar')]
        # Compact JSON with Unicode matches the server's JSON.stringify hash.
        source_hash = hashlib.sha256(json.dumps(arabic, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        previous = completed.get((p['id'], source_hash))
        if previous:
            output.append(previous)
            continue
        result = {'id': p['id'], 'source_hash': source_hash}
        for key, text in zip(('name_en', 'short_description_en', 'details_en'), arabic):
            if not text:
                result[key] = ''
            else:
                if text not in cache:
                    # Translate paragraphs individually to avoid silent model truncation.
                    paragraphs = text.splitlines()
                    cache[text] = '\n'.join(translator.translate(s) if s.strip() else '' for s in paragraphs)
                result[key] = cache[text]
        output.append(result)
        destination.parent.mkdir(parents=True, exist_ok=True)
        tmp = destination.with_suffix('.tmp')
        tmp.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
        tmp.replace(destination)
        print(f'{index+1}/{len(records)} translated', flush=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
