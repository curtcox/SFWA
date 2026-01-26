# SFWA-ABI Harness

This harness validates HTML compliance and JS compliance separately for a SFWA (single-file web app) using a `sfwa-abi-1` spec.

## Files
- `sfwa_harness.py` - main CLI (HTML checks; invokes Node for JS checks)
- `sfwa_js_harness.mjs` - Node sandbox for JS-side checks

## Usage
```bash
python sfwa_harness.py --spec path/to/app.sfwa-abi.json --html path/to/app.html
python sfwa_harness.py --spec ... --html ... --mode html
python sfwa_harness.py --spec ... --html ... --mode js
python sfwa_harness.py --spec ... --html ... --mode all --json
```

## What it checks

### HTML-side
- All `spec.html.requires.ids` exist exactly once.
- Required selectors (limited subset): `meta[charset]`, `meta[name='viewport']`, `title`.
- `dataAttributes` are enforced only when the spec lists explicit required values (non-empty list).

### JS-side
- Executes inline scripts without throwing (in a minimal DOM + hash/history shim).
- Ensures required marker strings exist in script source (per spec).
- Ensures expected event listeners were registered (best-effort).
- Ensures hash is read/written and required write methods were used (per spec).

## Limitations
- CSS selectors are intentionally limited. Extend `check_html()` if you add more selectors to specs.
- The JS sandbox is minimal. If apps rely on more DOM/Web APIs, extend `sfwa_js_harness.mjs`.
- This harness is ABI-level: it does not validate app meaning/semantics.
