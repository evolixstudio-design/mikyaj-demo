# Free bilingual translation service

The server adapter supports Arabic → English and English → Arabic through a LibreTranslate-compatible endpoint. `scripts/translation-server.py` runs OPUS models locally; it does not send product content to a paid API. Machine output still needs review, particularly brand names, shades, ingredients and claims. Existing non-empty translations are never replaced by the editor's translation action.

Models and attribution:

- [Helsinki-NLP/opus-mt-tc-big-ar-en](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-ar-en), OPUS-MT, CC BY 4.0. Converted to CTranslate2 int8 for inference; the model is not fine-tuned.
- [Helsinki-NLP/opus-mt-en-ar](https://huggingface.co/Helsinki-NLP/opus-mt-en-ar), OPUS-MT, Apache 2.0. Converted to CTranslate2 int8; uses the `>>ara<<` target-language token.
- Jörg Tiedemann and Santhosh Thottingal, *OPUS-MT – Building open translation services for the World*, EAMT 2020.

## Local setup

The existing `.translation-venv` has CTranslate2, Transformers and tokenizer dependencies. Run:

```powershell
.translation-venv/Scripts/python.exe scripts/translation-server.py --prepare
.translation-venv/Scripts/python.exe scripts/translation-server.py
$env:TRANSLATION_URL='http://127.0.0.1:8765'
npm run preview:test -- --catalog
```

Preparation downloads the English → Arabic model once. Files are cached under ignored `.translation-models`. Subsequent service starts use cached models. A health endpoint reports loaded directions. The service listens only on localhost and rejects requests containing a browser Origin header. Never expose this Python development server to the public internet.

## Deployment

Run the translation worker as a private supervised service with sufficient CPU/RAM, or deploy a private LibreTranslate instance. Configure the backend's `TRANSLATION_URL` and optional `TRANSLATION_API_KEY`. The browser calls only the authenticated Mikyaj backend. The API returns a visible failure if the worker is unavailable; it never presents Arabic source text as a successful English translation.

The alternative Google adapter uses `GOOGLE_TRANSLATE_API_KEY` in encrypted server-side integration storage. It is optional and may incur charges. No Google translation account is required for the local OPUS worker.

Offline catalog export/import remains supported and protects source hashes and reviewed edits. Review full-catalog translations before production import; the new interactive translation service does not automatically bulk-publish catalog descriptions.

## Resumable full-catalog descriptions

Export from the admin translation module, then use:

```powershell
.translation-venv/Scripts/python.exe scripts/translate-missing-descriptions.py source.json translation-output/descriptions-machine.jsonl
```

This script preserves existing English fields and caches repeated source text. Re-running the same input/output resumes completed product/source-hash pairs. Keep the cache and JSONL output. Run only one writer per output file. For the isolated preview's current export, the importer is:

```powershell
node scripts/import-description-translations.cjs --preview --watch
```

That importer targets only `127.0.0.1:3101`, authenticates with the preview account, and saves its ledger atomically. It is not a production import command. The regular admin import expects a JSON array, so convert the completed JSONL output to an array before manually importing an approved production batch. Source hashes and REVIEWED status prevent stale imports. The online “Translate next 2 products” action now also finds MACHINE records with missing descriptions and preserves existing English and concurrent edits.
