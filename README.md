# [SFWA](https://curtcox.github.io/SFWA/site-index.html)

# Me

I want to write an app that is not just a single page app, but a single file app. All of the code for the app will be contained in a single file. The state of the app will be contained in the page location part of the URL (after the #). So, when the file is hosted on a public server, the app with current state can be copied from one browser to another by copying the URL. The app can be served by any server that serves HTML files over HTTP. 

Does this type of app have a name?
Can you point me to any examples of such apps?
Any explanations on how to write one?

# ChatGPT 5.2 Thinking thought for 1m 32s

## What this is usually called

There is not one universally agreed-on name, but in practice people describe your pattern using two overlapping terms—one for the packaging and one for the state model:

- **Single-File Web App (SFWA) / self-contained web app**
A web application delivered as a single .html file that includes its HTML/CSS/JS (often with no other required assets).

- **URL-fragment state (a.k.a. hash-based app state, hash routing, deep-linking via #…)**
Using the URL fragment identifier (the part after #) to represent “application state” so the URL is bookmarkable/shareable. The W3C TAG explicitly calls out the # fragment being used to identify application states.

If you want a compact label that matches what you described, “single-file web app with URL-fragment–encoded state” is precise and immediately understandable.

## Examples you can study
**Mermaid Live Editor (real-world, production-grade pattern)**

Mermaid Live Editor encodes editor state in the URL hash so a diagram can be shared just by copying the URL, and it uses compression to keep URLs manageable.
[Mermaid Live](https://mermaid.live/edit#pako:eNpVjcFugzAQRH_F2lMrkQhwwI0PlRrS5hKpPeRUyMEKC0YNNjJGaQr8ew1R1XZOO5o3sz2cdI7AoTjry0kKY8lhmyni9JQm0lStrUV7JIvF47BDS2qt8DqQzd1Ok1bqpqlUeX_jNxNEkn4_YUisrNTHeIuSuf-qcCDbdC8aq5vj3-Rw0QN5Tqs36eb_J9Kga72kheCFWJyEIYkwMwIelKbKgVvToQc1mlpMFvopzcBKrDED7s4cC9GdbQaZGl2tEepd6_qnaXRXSnDz59a5rsmFxW0lSiN-EVQ5mkR3ygIP6DwBvIdP4KsVW0YPLGIh9eMoWDMPrsAZXQbhah2HNFxTSsN49OBr_ukvHew7hbHPmB9GwfgNxWN2oA)

**Minimal examples of “compress state into the hash”**

- A small demo showing lz-string compression and embedding data in the URL fragment (#…) specifically for copy/paste portability.
- Blog write-up demonstrating pako/DEFLATE to store larger state in the URL (inspired by Mermaid’s approach).
[mfyz](https://mfyz.com/storing-large-web-app-state-in-url-using-pako/?utm_source=chatgpt.com)

**“Single HTML file apps” collections/patterns**

- A GitHub repository collecting self-contained single-HTML-file apps (useful for structure and packaging ideas, even if not all of them store state in the hash).
[single-html-file-apps](https://github.com/drakeaxelrod/single-html-file-apps?utm_source=chatgpt.com)
- The older-but-influential “HTML ROMs” framing: single-file web applications intended to be durable/portable. [Conroy](https://conroy.org/self-contained-web-apps?utm_source=chatgpt.com)

## How to write one (practical architecture)

### 1) Decide what “state” means

Keep a single canonical JS object (or a small set of primitives) that fully describes what a user should be able to reproduce by copying the URL.

Example:

- selected tab/view
- filters/sort
- the document being edited (if small enough)
- UI toggles

### 2) Define a stable serialization format

Start simple:

- Small state:
hash = encodeURIComponent(JSON.stringify(state))

- Larger state:
hash = <compress>(JSON.stringify(state))
Then encode into URL-safe characters (often base64url-like).

Mermaid Live Editor is a good reference point here: it serializes state to JSON, compresses, then encodes into a URL-safe string and syncs that into the URL hash.

### 3) Make the URL the source of truth on load

On initial page load:

- Parse location.hash
- If valid, hydrate state from it
- If missing/invalid, fall back to defaults and write a canonical hash

### 4) Keep hash <-> state synchronized

You want two event flows:

- User interaction → state updates → URL updates
- External URL change (paste/back/forward/manual edit) → state updates → re-render

The browser gives you hashchange for the second flow.
[Stack Overflow](https://stackoverflow.com/questions/7729580/how-can-i-use-urls-in-a-single-page-application?utm_source=chatgpt.com)

### 5) Choose history semantics

Two common approaches:

- history.replaceState(..., "#...") for frequent updates (typing/dragging) so you don’t spam the back button.

- history.pushState(..., "#...") for “milestone” changes (changing views, committing an edit) so back/forward feels natural.

### 6) Watch the hard limits and gotchas

- URL length limits are real (vary by browser, proxies, etc.). Compression helps, but you still need a plan for truly large documents (e.g., “export to file” or optional localStorage cache).

- Never put secrets in the URL (URLs get logged, shared, synced, etc.).

- The fragment (#...) is not sent to the server, which is exactly why it works well for static hosting—but it also means server-side logic can’t see it.

## A minimal skeleton (vanilla JS, no compression)

```javascript
<!doctype html>
<meta charset="utf-8" />
<title>Single-file, hash-state app</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; }
  button { margin-right: 8px; }
  pre { background: #f6f6f6; padding: 12px; border-radius: 8px; }
</style>

<h1>Hash State Demo</h1>
<div>
  <button id="dec">-</button>
  <button id="inc">+</button>
</div>
<p>Copy the URL (including the #...) into another browser to reproduce state.</p>
<pre id="view"></pre>

<script>
  const DEFAULT_STATE = { counter: 0 };

  function decodeHash() {
    const raw = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if (!raw) return { ...DEFAULT_STATE };
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  function encodeHash(state) {
    return "#" + encodeURIComponent(JSON.stringify(state));
  }

  function setHash(state, { replace = true } = {}) {
    const url = encodeHash(state);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  }

  let state = decodeHash();

  function render() {
    document.getElementById("view").textContent =
      JSON.stringify({ state, hash: location.hash }, null, 2);
  }

  function update(mutator, { milestone = false } = {}) {
    state = mutator({ ...state });
    setHash(state, { replace: !milestone });
    render();
  }

  document.getElementById("dec").onclick = () =>
    update(s => (s.counter--, s), { milestone: true });

  document.getElementById("inc").onclick = () =>
    update(s => (s.counter++, s), { milestone: true });

  window.addEventListener("hashchange", () => {
    state = decodeHash();
    render();
  });

  // Canonicalize hash on first load
  setHash(state, { replace: true });
  render();
</script>
```

To evolve this into a “real” app, you typically add:

- a small router (e.g., #view=search&... or #/search/...)
- compression (lz-string or pako) when the state stops fitting comfortably in a URL
- a debounced URL updater for text editors

If you tell me what kind of state you expect (tiny config vs. full documents), I can recommend a concrete encoding strategy (plain JSON vs. lz-string vs. DEFLATE/pako) and a URL schema that will stay stable as the app grows.

# Me
constant arrays (in the file):

- ingredients: ground beef, carrots, onions, apples, oranges, bread, hamburger buns, etc...
- meals : lists of dishes -- burgers and fries, tacos, tomato soup and grilled cheese, etc...
- main dishes : lists of ingredients + prep time -- burgers: ground beef, cheese, buns, 30 minutes, etc..
- side dishes : lists of ingredients + prep time -- salsa, rotel, olive oil, green onions, 5 minutes, etc...

state variables (in the #):
- past meals : list of meals -- meals from the rcent past
- planned meals : list of meals -- meals desired for the near future
- favorite meals : list of meals -- meals marked as favorites
- on hand : list of ingredients -- ingredients currently available for meals

derived:
- potential meals : list of meals -- meals that could be made with on hand favoring favorites
- needed : list of ingredients -- ingredients needed for planned meals that are not on hand

state variable encoding:

To reduce the URL size, always use the following encoding:
1. Use the same order for all of the state lists. Don't include any variable names.
2. Interpret a missing or invalid state as an empty list.
3. Use base 62 for everything.
4. Full state will be a list of 4 lists and thus start with a 4.
5. Store each list as a single character size followed by two character item indexes. Thus, the full state will be a single long base 62 string.

actions:
- add/remove favorite meal
- add/remove/done planned meal -- done adds a meal to the past. It also removes the first instance of it from planned and removes the ingredients. Don't keep more than 14 past meals.
- add/remove on hand 

Show all of the nicely formatted state variables, derived variables, and actions.
Display an error message when the loaded state is invalid.

# ChatGPT 5.2 Thinking thought for 2m 10s

Below is a complete, self-contained “single-file + hash-state” meal planner that implements your constant arrays, state variables, derived variables, actions, and the exact URL encoding/decoding rules you specified.

Save it as (for example) meal-planner.html, open it locally, or host it on any static HTTP server. The full app state lives in the URL fragment (#...), so copying the URL reproduces the state in another browser.

**Notes on your encoding rules (implemented exactly)**

- State order is fixed and unnamed: **past, planned, favorites, onHand**
- Missing state (# absent) is treated as empty, and the app canonicalizes it to #40000
- Invalid state is treated as empty and an error banner is shown
- Base62 alphabet used: 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
- Full state begins with a base62-encoded 4
- Each list is: **1 char length + (2 chars per item index)**

```javascript
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Single-File Meal Planner (Hash State)</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; line-height: 1.35; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 20px 0 8px; font-size: 16px; }
    h3 { margin: 14px 0 8px; font-size: 14px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .card { border: 1px solid rgba(127,127,127,.35); border-radius: 10px; padding: 12px; background: rgba(127,127,127,.06); }
    .card.wide { width: min(1100px, 100%); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; width: min(1100px, 100%); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .small { font-size: 12px; opacity: 0.85; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(127,127,127,.35); font-size: 12px; }
    .danger { border-color: rgba(200,0,0,.55); background: rgba(200,0,0,.08); }
    .ok { border-color: rgba(0,120,0,.55); background: rgba(0,120,0,.08); }
    .btn { cursor: pointer; border: 1px solid rgba(127,127,127,.45); background: transparent; border-radius: 8px; padding: 6px 10px; font-size: 12px; }
    .btn:hover { background: rgba(127,127,127,.10); }
    .btn.primary { border-color: rgba(0,90,200,.6); }
    .btn.danger { border-color: rgba(200,0,0,.6); }
    select { border-radius: 8px; padding: 6px 8px; border: 1px solid rgba(127,127,127,.45); background: transparent; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    li { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; vertical-align: top; border-top: 1px solid rgba(127,127,127,.25); padding: 8px 6px; font-size: 12px; }
    th { font-weight: 600; opacity: .9; }
    .right { text-align: right; }
    .muted { opacity: .75; }
    .stack > * + * { margin-top: 8px; }
    .nowrap { white-space: nowrap; }
  </style>
</head>

<body>
  <h1>Meal Planner (Single File + Hash State)</h1>

  <div id="errorBanner" class="card wide danger" style="display:none;">
    <div class="row" style="justify-content: space-between;">
      <div>
        <strong>Invalid URL state loaded.</strong>
        <div id="errorText" class="small"></div>
      </div>
      <button class="btn danger" id="btnClearToEmpty">Reset URL to empty (#40000)</button>
    </div>
  </div>

  <div class="card wide">
    <div class="row" style="justify-content: space-between;">
      <div class="stack" style="min-width: 260px;">
        <div><span class="pill ok">State in URL hash</span></div>
        <div class="small muted">Copy/paste the URL to move the current app state to another browser.</div>
        <div><span class="mono" id="hashString"></span></div>
        <div class="small muted">Hash length: <span id="hashLen" class="mono"></span></div>
      </div>
      <div class="row">
        <button class="btn primary" id="btnCopyUrl">Copy full URL</button>
        <button class="btn" id="btnCanonicalize">Canonicalize (rewrite hash)</button>
      </div>
    </div>
    <div id="msg" class="small" style="margin-top: 8px;"></div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Actions</h2>

      <h3>Add planned meal</h3>
      <div class="row">
        <select id="selPlanMeal"></select>
        <button class="btn primary" id="btnAddPlanned">Add to planned</button>
      </div>

      <h3>Add on-hand ingredient</h3>
      <div class="row">
        <select id="selOnHand"></select>
        <button class="btn primary" id="btnAddOnHand">Add on hand</button>
      </div>

      <h3>Quick rules</h3>
      <ul class="small muted">
        <li><span class="mono">done planned</span> adds meal to past, removes first instance from planned, removes its ingredients from on-hand, keeps at most 14 past meals.</li>
        <li>Favorites and on-hand are treated as sets for add/remove (no duplicates added).</li>
        <li>Encoding limits: each list length ≤ 61; each item index ≤ 3843.</li>
      </ul>
    </div>

    <div class="card">
      <h2>Derived</h2>

      <h3>Potential meals (can be made now; favorites first)</h3>
      <div id="potentialMeals"></div>

      <h3>Needed ingredients (planned but not on hand)</h3>
      <div id="neededIngredients"></div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>State</h2>

      <h3>Past meals (max 14)</h3>
      <div id="pastMeals"></div>

      <h3>Planned meals</h3>
      <div id="plannedMeals"></div>

      <h3>Favorite meals</h3>
      <div id="favoriteMeals"></div>

      <h3>On-hand ingredients</h3>
      <div id="onHand"></div>
    </div>

    <div class="card">
      <h2>Catalog</h2>
      <div class="small muted">Constants embedded in this single file.</div>

      <h3>Meals</h3>
      <div id="allMeals"></div>

      <h3>Ingredients</h3>
      <div id="allIngredients"></div>
    </div>
  </div>

  <div class="card wide">
    <h2>Debug</h2>
    <div class="small muted">Raw internal state arrays (meal/ingredient indices) in fixed order: past, planned, favorites, onHand.</div>
    <pre id="debug" class="mono" style="margin:8px 0 0; overflow:auto;"></pre>
  </div>

<script>
(() => {
  "use strict";

  // ---------------------------
  // Base62 (as specified)
  // ---------------------------
  const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const B = 62;

  function enc62(n) {
    if (!Number.isInteger(n) || n < 0 || n >= B) throw new Error(`enc62 out of range: ${n}`);
    return BASE62[n];
  }
  function dec62(ch) {
    const i = BASE62.indexOf(ch);
    return i === -1 ? null : i;
  }
  function enc62_2(n) {
    if (!Number.isInteger(n) || n < 0 || n >= B*B) throw new Error(`enc62_2 out of range: ${n}`);
    return enc62(Math.floor(n / B)) + enc62(n % B);
  }
  function dec62_2(s, pos) {
    if (pos + 1 >= s.length) return null;
    const a = dec62(s[pos]);
    const b = dec62(s[pos + 1]);
    if (a === null || b === null) return null;
    return a * B + b;
  }

  // ---------------------------
  // Constants (as requested)
  // ---------------------------
  const ingredients = [
    "ground beef", "carrots", "onions", "apples", "oranges", "bread", "hamburger buns",
    "cheddar cheese", "potatoes", "tortillas", "lettuce", "tomatoes", "salsa", "rotel",
    "olive oil", "green onions", "canned tomato soup", "butter", "salt", "pepper", "garlic",
    "chicken breast", "rice", "black beans", "taco seasoning", "pickles", "ketchup", "mustard",
    "milk", "eggs", "broccoli", "soy sauce", "ginger", "pasta", "marinara sauce", "parmesan"
  ];

  function ingId(name) {
    const i = ingredients.indexOf(name);
    if (i === -1) throw new Error(`Unknown ingredient: ${name}`);
    return i;
  }

  // Dishes (main + side) with ingredients + prep time
  const dishes = [
    // Main dishes
    { type: "main", name: "Burgers", prepMin: 30, ingredients: [ingId("ground beef"), ingId("cheddar cheese"), ingId("hamburger buns"), ingId("onions"), ingId("salt"), ingId("pepper")] },
    { type: "main", name: "Tacos", prepMin: 25, ingredients: [ingId("ground beef"), ingId("tortillas"), ingId("lettuce"), ingId("tomatoes"), ingId("cheddar cheese"), ingId("taco seasoning"), ingId("onions")] },
    { type: "main", name: "Tomato soup", prepMin: 10, ingredients: [ingId("canned tomato soup"), ingId("milk"), ingId("butter")] },
    { type: "main", name: "Grilled cheese", prepMin: 10, ingredients: [ingId("bread"), ingId("cheddar cheese"), ingId("butter")] },
    { type: "main", name: "Chicken stir-fry", prepMin: 25, ingredients: [ingId("chicken breast"), ingId("broccoli"), ingId("soy sauce"), ingId("garlic"), ingId("ginger"), ingId("olive oil")] },
    { type: "main", name: "Pasta marinara", prepMin: 25, ingredients: [ingId("pasta"), ingId("marinara sauce"), ingId("olive oil"), ingId("garlic"), ingId("parmesan")] },
    { type: "main", name: "Scrambled eggs", prepMin: 10, ingredients: [ingId("eggs"), ingId("milk"), ingId("butter"), ingId("salt"), ingId("pepper")] },

    // Side dishes
    { type: "side", name: "Fries", prepMin: 25, ingredients: [ingId("potatoes"), ingId("olive oil"), ingId("salt")] },
    { type: "side", name: "Rotel salsa", prepMin: 5, ingredients: [ingId("rotel"), ingId("green onions"), ingId("salsa")] },
    { type: "side", name: "Simple salad", prepMin: 8, ingredients: [ingId("lettuce"), ingId("tomatoes"), ingId("onions"), ingId("olive oil"), ingId("salt")] },
    { type: "side", name: "Rice", prepMin: 20, ingredients: [ingId("rice"), ingId("salt"), ingId("butter")] },
    { type: "side", name: "Black beans", prepMin: 15, ingredients: [ingId("black beans"), ingId("onions"), ingId("garlic"), ingId("olive oil"), ingId("salt")] },
    { type: "side", name: "Fruit bowl", prepMin: 5, ingredients: [ingId("apples"), ingId("oranges")] },
    { type: "side", name: "Carrot sticks", prepMin: 5, ingredients: [ingId("carrots")] }
  ];

  // Meals: lists of dishes
  const meals = [
    { name: "Burgers and fries", dishIds: [0, 7] },
    { name: "Tacos and rotel salsa", dishIds: [1, 8] },
    { name: "Tomato soup and grilled cheese", dishIds: [2, 3] },
    { name: "Chicken stir-fry and rice", dishIds: [4, 10] },
    { name: "Pasta marinara and salad", dishIds: [5, 9] },
    { name: "Breakfast for dinner", dishIds: [6, 12] },
    { name: "Tacos and black beans", dishIds: [1, 11] },
    { name: "Burgers and salad", dishIds: [0, 9] }
  ];

  // ---------------------------
  // State variables (in hash)
  // ---------------------------
  function emptyState() {
    return {
      past: [],      // list of meal indices
      planned: [],   // list of meal indices
      favorites: [], // list of meal indices
      onHand: []     // list of ingredient indices
    };
  }

  // Encoding rules (exactly as specified):
  // 1) fixed order, no variable names
  // 2) missing/invalid => empty lists
  // 3) base62 for everything
  // 4) full state starts with '4'
  // 5) each list stored as: 1-char size + (2-char item index)*size
  function encodeState(st) {
    const lists = [st.past, st.planned, st.favorites, st.onHand];
    // Validate length and index range
    for (const list of lists) {
      if (list.length > 61) throw new Error("List too long for single-char base62 length (max 61).");
      for (const idx of list) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= B*B) throw new Error(`Item index out of range for 2-char base62: ${idx}`);
      }
    }
    let s = enc62(4);
    for (const list of lists) {
      s += enc62(list.length);
      for (const idx of list) s += enc62_2(idx);
    }
    return s;
  }

  function decodeState(hashStr) {
    // Returns: { state, error } where error is null or string
    if (!hashStr) return { state: emptyState(), error: null };

    const s = hashStr;
    const first = dec62(s[0]);
    if (first === null) return { state: emptyState(), error: "First character is not valid base62." };
    if (first !== 4) return { state: emptyState(), error: `Expected first base62 digit to represent 4 lists; got ${first}.` };

    let pos = 1;
    const out = emptyState();
    const targetLists = ["past", "planned", "favorites", "onHand"];

    for (let li = 0; li < 4; li++) {
      if (pos >= s.length) return { state: emptyState(), error: "Unexpected end of string while reading list size." };
      const size = dec62(s[pos++]);
      if (size === null) return { state: emptyState(), error: "Invalid base62 digit in list size." };

      const need = size * 2;
      if (pos + need > s.length) return { state: emptyState(), error: "Unexpected end of string while reading list items." };

      const arr = [];
      for (let j = 0; j < size; j++) {
        const val = dec62_2(s, pos);
        if (val === null) return { state: emptyState(), error: "Invalid base62 digit in item index." };
        arr.push(val);
        pos += 2;
      }
      out[targetLists[li]] = arr;
    }

    if (pos !== s.length) {
      return { state: emptyState(), error: "Trailing characters found after parsing 4 lists." };
    }

    // Validate indices against catalog sizes
    const maxMeal = meals.length;
    const maxIng = ingredients.length;

    const mealLists = [out.past, out.planned, out.favorites];
    for (const list of mealLists) {
      for (const id of list) if (id < 0 || id >= maxMeal) return { state: emptyState(), error: `Meal index out of range: ${id} (meals=${maxMeal}).` };
    }
    for (const id of out.onHand) if (id < 0 || id >= maxIng) return { state: emptyState(), error: `Ingredient index out of range: ${id} (ingredients=${maxIng}).` };

    return { state: out, error: null };
  }

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function uniq(arr) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      if (!seen.has(x)) { seen.add(x); out.push(x); }
    }
    return out;
  }

  function removeFirst(arr, value) {
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1);
  }

  function mealTotalPrep(mealId) {
    return meals[mealId].dishIds.reduce((sum, did) => sum + dishes[did].prepMin, 0);
  }

  function mealIngredientIds(mealId) {
    const ids = [];
    for (const did of meals[mealId].dishIds) ids.push(...dishes[did].ingredients);
    return uniq(ids);
  }

  function mealIngredientNames(mealId) {
    return mealIngredientIds(mealId).map(i => ingredients[i]);
  }

  function dishNames(mealId) {
    return meals[mealId].dishIds.map(did => dishes[did].name);
  }

  function safeText(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
  }

  // ---------------------------
  // App state + hash integration
  // ---------------------------
  let app = {
    state: emptyState(),
    loadError: null
  };

  function setMessage(text, isError=false) {
    const el = $("msg");
    el.textContent = text || "";
    el.style.color = isError ? "rgb(200,0,0)" : "";
  }

  function getHashRaw() {
    return (location.hash || "").replace(/^#/, "");
  }

  function writeHashFromState(st, { push=false } = {}) {
    const encoded = encodeState(st);
    const newUrl = location.pathname + location.search + "#" + encoded;
    if (push) history.pushState(null, "", newUrl);
    else history.replaceState(null, "", newUrl);
  }

  function canonicalEmptyHash() {
    const st = emptyState();
    writeHashFromState(st, { push:false });
  }

  function loadFromHash() {
    const raw = getHashRaw();
    const { state, error } = decodeState(raw);

    app.state = state;
    app.loadError = error;

    if (!raw) {
      // Missing state => empty list; canonicalize to a shareable empty hash.
      canonicalEmptyHash();
      app.loadError = null; // missing isn't "invalid"
    }
    render();
  }

  // ---------------------------
  // Derived
  // ---------------------------
  function computeDerived(st) {
    const favSet = new Set(st.favorites);
    const onHandSet = new Set(st.onHand);

    // Potential meals: all required ingredients are on-hand; favorites first.
    const potentials = [];
    for (let mid = 0; mid < meals.length; mid++) {
      const req = mealIngredientIds(mid);
      const ok = req.every(i => onHandSet.has(i));
      if (ok) {
        potentials.push({
          mealId: mid,
          isFavorite: favSet.has(mid),
          prep: mealTotalPrep(mid)
        });
      }
    }
    potentials.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.prep !== b.prep) return a.prep - b.prep;
      return meals[a.mealId].name.localeCompare(meals[b.mealId].name);
    });

    // Needed ingredients: union of planned requirements minus on-hand
    const neededSet = new Set();
    for (const mid of st.planned) {
      for (const iid of mealIngredientIds(mid)) {
        if (!onHandSet.has(iid)) neededSet.add(iid);
      }
    }
    const needed = Array.from(neededSet).sort((a, b) => ingredients[a].localeCompare(ingredients[b]));

    return { potentials, needed };
  }

  // ---------------------------
  // Actions (as specified)
  // ---------------------------
  function toggleFavorite(mealId) {
    const st = structuredClone(app.state);
    const i = st.favorites.indexOf(mealId);
    if (i >= 0) st.favorites.splice(i, 1);
    else st.favorites.push(mealId);

    // Keep favorites unique by construction
    st.favorites = uniq(st.favorites);

    commitState(st);
  }

  function addPlanned(mealId) {
    const st = structuredClone(app.state);
    st.planned.push(mealId);
    commitState(st);
  }

  function removePlannedAt(index) {
    const st = structuredClone(app.state);
    if (index >= 0 && index < st.planned.length) st.planned.splice(index, 1);
    commitState(st);
  }

  function donePlannedAt(index) {
    const st = structuredClone(app.state);
    if (index < 0 || index >= st.planned.length) return;

    const mealId = st.planned[index];

    // Remove first instance at the specific index
    st.planned.splice(index, 1);

    // Add to past (most recent first), cap at 14
    st.past.unshift(mealId);
    if (st.past.length > 14) st.past.length = 14;

    // Remove the meal's ingredients from on-hand (set difference; no quantities tracked)
    const req = mealIngredientIds(mealId);
    const onHandSet = new Set(st.onHand);
    for (const iid of req) onHandSet.delete(iid);
    st.onHand = Array.from(onHandSet).sort((a, b) => ingredients[a].localeCompare(ingredients[b]));

    commitState(st);
  }

  function toggleOnHand(ingredientId) {
    const st = structuredClone(app.state);
    const i = st.onHand.indexOf(ingredientId);
    if (i >= 0) st.onHand.splice(i, 1);
    else st.onHand.push(ingredientId);

    st.onHand = uniq(st.onHand).sort((a, b) => ingredients[a].localeCompare(ingredients[b]));
    commitState(st);
  }

  function commitState(st) {
    try {
      // Ensure list-length constraints before writing
      encodeState(st);
      writeHashFromState(st, { push: false });
      app.loadError = null;
      setMessage("");
      // render will happen from hashchange OR directly; do it directly for responsiveness:
      app.state = st;
      render();
    } catch (e) {
      setMessage(String(e && e.message ? e.message : e), true);
      render();
    }
  }

  // ---------------------------
  // Rendering
  // ---------------------------
  function renderListOfMeals(title, mealIds, opts = {}) {
    const { allowRemove=false, allowDone=false, listType="" } = opts;

    if (!mealIds.length) return `<div class="small muted">Empty.</div>`;

    const rows = mealIds.map((mid, idx) => {
      const fav = app.state.favorites.includes(mid);
      const dishesTxt = dishNames(mid).join(", ");
      const prep = mealTotalPrep(mid);
      const actions = [];
      actions.push(`<button class="btn" data-action="fav" data-meal="${mid}">${fav ? "Unfavorite" : "Favorite"}</button>`);
      if (allowDone) actions.push(`<button class="btn primary" data-action="donePlanned" data-index="${idx}">Done</button>`);
      if (allowRemove) actions.push(`<button class="btn danger" data-action="removePlanned" data-index="${idx}">Remove</button>`);

      return `
        <tr>
          <td><strong>${safeText(meals[mid].name)}</strong><div class="small muted">${safeText(dishesTxt)}</div></td>
          <td class="nowrap">${prep} min</td>
          <td class="right">${actions.join(" ")}</td>
        </tr>
      `;
    }).join("");

    return `
      <table>
        <thead>
          <tr>
            <th>${safeText(title)}</th>
            <th class="nowrap">Prep</th>
            <th class="right">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderListOfIngredients(ids) {
    if (!ids.length) return `<div class="small muted">Empty.</div>`;
    const lis = ids
      .slice()
      .sort((a, b) => ingredients[a].localeCompare(ingredients[b]))
      .map(iid => {
        return `
          <li>
            <span>${safeText(ingredients[iid])}</span>
            <span class="muted small mono"> (#${iid})</span>
            <button class="btn danger" style="margin-left:8px;" data-action="toggleOnHand" data-ing="${iid}">Remove</button>
          </li>
        `;
      }).join("");
    return `<ul>${lis}</ul>`;
  }

  function renderDerived(derived) {
    // Potential meals
    if (!derived.potentials.length) {
      $("potentialMeals").innerHTML = `<div class="small muted">None (no meals fully covered by on-hand ingredients).</div>`;
    } else {
      const rows = derived.potentials.map(p => {
        const mid = p.mealId;
        const fav = p.isFavorite;
        const req = mealIngredientNames(mid).join(", ");
        return `
          <tr>
            <td>
              <strong>${safeText(meals[mid].name)}</strong>
              ${fav ? ` <span class="pill">favorite</span>` : ``}
              <div class="small muted">Requires: ${safeText(req)}</div>
            </td>
            <td class="nowrap">${p.prep} min</td>
            <td class="right">
              <button class="btn primary" data-action="plan" data-meal="${mid}">Plan</button>
              <button class="btn" data-action="fav" data-meal="${mid}">${app.state.favorites.includes(mid) ? "Unfavorite" : "Favorite"}</button>
            </td>
          </tr>
        `;
      }).join("");

      $("potentialMeals").innerHTML = `
        <table>
          <thead>
            <tr><th>Meal</th><th class="nowrap">Prep</th><th class="right">Actions</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // Needed ingredients
    if (!derived.needed.length) {
      $("neededIngredients").innerHTML = `<div class="small muted">None (all planned meal ingredients are on hand).</div>`;
    } else {
      const lis = derived.needed.map(iid => `<li>${safeText(ingredients[iid])} <span class="muted small mono">(#${iid})</span></li>`).join("");
      $("neededIngredients").innerHTML = `<ul>${lis}</ul>`;
    }
  }

  function renderCatalog() {
    // Meals catalog
    const rows = meals.map((m, mid) => {
      const fav = app.state.favorites.includes(mid);
      const onHandSet = new Set(app.state.onHand);
      const reqIds = mealIngredientIds(mid);
      const missing = reqIds.filter(x => !onHandSet.has(x));
      const reqNames = reqIds.map(i => ingredients[i]).join(", ");
      const missTxt = missing.length ? `Missing: ${missing.map(i => ingredients[i]).join(", ")}` : "All ingredients on hand";
      const prep = mealTotalPrep(mid);

      return `
        <tr>
          <td>
            <strong>${safeText(m.name)}</strong>
            ${fav ? ` <span class="pill">favorite</span>` : ``}
            <div class="small muted">Dishes: ${safeText(m.dishIds.map(did => dishes[did].name).join(", "))}</div>
            <div class="small muted">Ingredients: ${safeText(reqNames)}</div>
            <div class="small ${missing.length ? "muted" : ""}">${safeText(missTxt)}</div>
          </td>
          <td class="nowrap">${prep} min</td>
          <td class="right">
            <button class="btn primary" data-action="plan" data-meal="${mid}">Plan</button>
            <button class="btn" data-action="fav" data-meal="${mid}">${fav ? "Unfavorite" : "Favorite"}</button>
          </td>
        </tr>
      `;
    }).join("");

    $("allMeals").innerHTML = `
      <table>
        <thead><tr><th>Meal</th><th class="nowrap">Prep</th><th class="right">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Ingredients catalog
    const lis = ingredients.map((name, iid) => {
      const has = app.state.onHand.includes(iid);
      return `
        <li>
          <span>${safeText(name)}</span> <span class="muted small mono">(#${iid})</span>
          <button class="btn ${has ? "danger" : "primary"}" style="margin-left:8px;" data-action="toggleOnHand" data-ing="${iid}">
            ${has ? "Remove on hand" : "Add on hand"}
          </button>
        </li>
      `;
    }).join("");
    $("allIngredients").innerHTML = `<ul>${lis}</ul>`;
  }

  function render() {
    // Error banner
    if (app.loadError) {
      $("errorBanner").style.display = "";
      $("errorText").textContent = app.loadError;
    } else {
      $("errorBanner").style.display = "none";
      $("errorText").textContent = "";
    }

    // Hash display
    const raw = getHashRaw();
    $("hashString").textContent = "#" + raw;
    $("hashLen").textContent = String(raw.length);

    // State sections
    $("pastMeals").innerHTML = renderListOfMeals("Past", app.state.past, { allowRemove:false, allowDone:false, listType:"past" });
    $("plannedMeals").innerHTML = renderListOfMeals("Planned", app.state.planned, { allowRemove:true, allowDone:true, listType:"planned" });
    $("favoriteMeals").innerHTML = renderListOfMeals("Favorites", app.state.favorites, { allowRemove:false, allowDone:false, listType:"favorites" });
    $("onHand").innerHTML = renderListOfIngredients(app.state.onHand);

    // Derived
    const derived = computeDerived(app.state);
    renderDerived(derived);

    // Catalog
    renderCatalog();

    // Debug
    $("debug").textContent = JSON.stringify({
      order: ["past", "planned", "favorites", "onHand"],
      past: app.state.past,
      planned: app.state.planned,
      favorites: app.state.favorites,
      onHand: app.state.onHand
    }, null, 2);

    // Populate selects (stable)
    fillSelects();
  }

  function fillSelects() {
    // Planned meal select
    const planSel = $("selPlanMeal");
    if (!planSel.dataset.filled) {
      planSel.innerHTML = meals.map((m, mid) => `<option value="${mid}">${safeText(m.name)} (meal #${mid})</option>`).join("");
      planSel.dataset.filled = "1";
    }

    // Ingredient select for on-hand
    const ingSel = $("selOnHand");
    if (!ingSel.dataset.filled) {
      ingSel.innerHTML = ingredients.map((name, iid) => `<option value="${iid}">${safeText(name)} (ingredient #${iid})</option>`).join("");
      ingSel.dataset.filled = "1";
    }
  }

  // ---------------------------
  // Event wiring
  // ---------------------------
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.id === "btnAddPlanned") {
      const mid = Number($("selPlanMeal").value);
      addPlanned(mid);
      return;
    }
    if (t.id === "btnAddOnHand") {
      const iid = Number($("selOnHand").value);
      toggleOnHand(iid); // toggle acts as add/remove; this is add-focused UI
      return;
    }
    if (t.id === "btnCopyUrl") {
      const url = location.href;
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Copied URL to clipboard.");
      } catch {
        setMessage("Could not copy automatically (clipboard permission). Manually copy from the address bar.", true);
      }
      return;
    }
    if (t.id === "btnCanonicalize") {
      try {
        // If current hash is invalid, keep error until user resets; canonicalize only if current decodes cleanly.
        const raw = getHashRaw();
        const decoded = decodeState(raw);
        if (decoded.error) {
          setMessage("Cannot canonicalize: current hash is invalid. Use Reset URL to empty, or take an action to generate a valid hash.", true);
          return;
        }
        writeHashFromState(app.state, { push:false });
        setMessage("Rewrote hash in canonical form.");
        render();
      } catch (err) {
        setMessage(String(err && err.message ? err.message : err), true);
      }
      return;
    }
    if (t.id === "btnClearToEmpty") {
      canonicalEmptyHash();
      app.loadError = null;
      setMessage("Reset to empty state (#40000).");
      loadFromHash();
      return;
    }

    // Delegated action buttons
    const action = t.getAttribute("data-action");
    if (!action) return;

    if (action === "fav") {
      const mid = Number(t.getAttribute("data-meal"));
      toggleFavorite(mid);
      return;
    }
    if (action === "plan") {
      const mid = Number(t.getAttribute("data-meal"));
      addPlanned(mid);
      return;
    }
    if (action === "removePlanned") {
      const idx = Number(t.getAttribute("data-index"));
      removePlannedAt(idx);
      return;
    }
    if (action === "donePlanned") {
      const idx = Number(t.getAttribute("data-index"));
      donePlannedAt(idx);
      return;
    }
    if (action === "toggleOnHand") {
      const iid = Number(t.getAttribute("data-ing"));
      toggleOnHand(iid);
      return;
    }
  });

  window.addEventListener("hashchange", () => {
    // Always treat the hash as the source of truth on navigation/back/forward/manual edit
    loadFromHash();
  });

  // ---------------------------
  // Boot
  // ---------------------------
  loadFromHash();
})();
</script>
</body>
</html>
```

If you want to push the “URL size” constraint further, the next step is usually to add an optional compressed mode (still base62) while keeping your current format as the canonical “uncompressed” representation. You can do that without breaking old links by reserving a leading tag (for example, still starting with 4, but using the next character as a “version/mode” digit).

# Notes

The conversation above is from 2026/01/24.
The [original](https://chatgpt.com/share/e/6975051f-f31c-8011-8607-80b4d95af32a) was lightly edited to make it more markdown friendly.
Sorry that link doesn't work for the general public due to my ChatGPT plan restrictions.

There are a huge number of ways to run web servers for static content.
I typically use the one built into python.

```bash
python -m http.server
```
