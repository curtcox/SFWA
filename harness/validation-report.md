# SFWA-ABI v1 extraction report

Repo: https://github.com/curtcox/SFWA
Ref: main
Retrieved via GitHub connector fetch (github.com/.../raw/... URLs).
Date: 2026-01-25

## Repo access / tooling notes
- file_search (slurm_github) returned `MissingGithubRepoSelection` because no repos are selected for code search in this chat session.
- GitHub connector access is working (able to fetch file contents from github.com URLs).

## Contracts produced
- demo.sfwa-abi.json
- meal-planner.sfwa-abi.json
- meal-planner-2.sfwa-abi.json
- paperclip-factory.sfwa-abi.json

## Findings that validate (and stress) the approach

### 1) HTML-side compliance is straightforward for all four
Each app’s JS binds to a fixed set of element IDs via getElementById (or wrappers), so an HTML-only validator can check:
- Required IDs exist exactly once (recommended rule).
- Required structural selectors exist (charset, viewport where applicable).

### 2) JS-side compliance is possible but these files highlight an important limitation
All four files implement JS inside an IIFE and do not export a runtime object. As a result:
- A *pure API-shape* JS validator (e.g., “window.SFWA_RUNTIME.decode/encode/init exist”) cannot pass without changing the code.
- JS compliance can still be validated by (a) static markers (heuristic) and/or (b) dynamic instrumentation (recommended).

**Recommendation if you want strong, deterministic JS-only compliance**:
Add a small export such as `window.SFWA_RUNTIME = { decode, encode, init }` (or equivalent) without otherwise changing behavior.

### 3) Dynamic DOM generation affects what belongs in the HTML-side contract
The meal planner apps generate most `data-action="..."` buttons dynamically via innerHTML templates.
Therefore, HTML-only compliance should NOT require those action elements to be present at load time.
Instead, treat them as JS-side obligations (the runtime must generate them and handle delegated clicks).

## Potential contract “edge cases” to capture if you tighten the ABI later
- demo.html uses `element.onclick = ...` instead of addEventListener; if you require addEventListener, it would fail.
- meal planner apps rely on `structuredClone`; older browsers may require a polyfill (not an ABI issue, but a portability concern).
- paperclip-factory uses `TextEncoder/TextDecoder`, `atob/btoa`, and requestAnimationFrame.

