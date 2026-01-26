#!/usr/bin/env node
/**
 * sfwa_js_harness.mjs - JS-side compliance harness for SFWA-ABI v1.
 *
 * Executes inline scripts from the HTML file inside a constrained environment
 * (minimal DOM + history/location/hash instrumentation) and returns JSON:
 *   { ok: boolean, errors: string[], details: {...} }
 *
 * ABI-level only: does not attempt to validate app semantics.
 */

import fs from "node:fs";
import vm from "node:vm";
import process from "node:process";
import path from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spec") out.spec = argv[++i];
    else if (a === "--html") out.html = argv[++i];
  }
  return out;
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function readText(p) { return fs.readFileSync(p, "utf8"); }

function extractInlineScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (!body.trim()) continue;
    scripts.push(body);
  }
  return scripts;
}

class HTMLElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.textContent = "";
    this.innerHTML = "";
    this.value = "";
    this.disabled = false;
    this.style = {};
    this.dataset = {};
    this._attrs = new Map();
    this._listeners = [];
    this._onclick = null;
  }
  setAttribute(name, value) { this._attrs.set(String(name), String(value)); }
  getAttribute(name) { return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null; }
  addEventListener(type, listener, options) { this._listeners.push({ type: String(type), target: "element" }); }
  set onclick(fn) { this._onclick = fn; this._listeners.push({ type: "click", target: "element", via: "property" }); }
  get onclick() { return this._onclick; }
  select() {}
}

class Document {
  constructor(elementsById, eventLog) {
    this._elementsById = elementsById;
    this._eventLog = eventLog;
    this.body = new HTMLElement("body");
  }
  getElementById(id) { return this._elementsById.get(String(id)) ?? null; }
  createElement(tag) { return new HTMLElement(tag); }
  addEventListener(type, listener, options) { this._eventLog.push({ target: "document", type: String(type) }); }
  execCommand(cmd) { return true; }
  appendChild(el) {}
  removeChild(el) {}
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.spec || !args.html) {
    console.error("Usage: node sfwa_js_harness.mjs --spec spec.json --html app.html");
    process.exit(2);
  }

  const spec = readJson(args.spec);
  if (spec.abi !== "sfwa-abi-1") {
    console.error(`Unsupported abi '${spec.abi}'. Expected 'sfwa-abi-1'.`);
    process.exit(2);
  }

  const html = readText(args.html);
  const scripts = extractInlineScripts(html);

  const requiredIds = (spec?.js?.requires?.domIds) || (spec?.html?.requires?.ids) || [];
  const expectedEvents = (spec?.js?.requires?.events) || [];
  const expectedHashIO = spec?.js?.requires?.hashIO || { readsLocationHash: true, writesHash: true, writeMethods: [] };
  const markers = (spec?.js?.requires?.markers) || [];
  const writesOnBoot = !!(spec?.state?.canonicalization?.writesOnBoot);

  const eventLog = [];
  let hashReads = 0;
  let hashWrites = 0;
  const writeMethodsUsed = new Set();
  const errors = [];

  const location = {
    _hash: "",
    pathname: "/",
    search: "",
    get hash() { hashReads++; return this._hash; },
    set hash(v) { hashWrites++; writeMethodsUsed.add("location.hash"); this._hash = String(v); },
    get href() { return "http://localhost/" + (this._hash || ""); }
  };

  const history = {
    replaceState(_a, _b, url) {
      hashWrites++;
      writeMethodsUsed.add("history.replaceState");
      if (typeof url === "string") {
        const idx = url.indexOf("#");
        location._hash = idx >= 0 ? url.slice(idx) : "";
      }
    },
    pushState(_a, _b, url) {
      hashWrites++;
      writeMethodsUsed.add("history.pushState");
      if (typeof url === "string") {
        const idx = url.indexOf("#");
        location._hash = idx >= 0 ? url.slice(idx) : "";
      }
    }
  };

  const windowObj = {
    addEventListener(type, listener, options) { eventLog.push({ target: "window", type: String(type) }); }
  };

  const navigator = { clipboard: { async writeText(_t) { return; } } };
  function requestAnimationFrame(_cb) {}

  const elementsById = new Map();
  for (const id of requiredIds) {
    const low = String(id).toLowerCase();
    const tag = (low.includes("sel") || low.includes("range") || low.includes("input")) ? "input" : "div";
    const el = new HTMLElement(tag);
    el.id = id;
    elementsById.set(id, el);
  }
  const documentObj = new Document(elementsById, eventLog);

  const atobImpl = globalThis.atob ?? ((b64) => Buffer.from(b64, "base64").toString("binary"));
  const btoaImpl = globalThis.btoa ?? ((bin) => Buffer.from(bin, "binary").toString("base64"));

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    structuredClone,
    TextEncoder,
    TextDecoder,
    atob: atobImpl,
    btoa: btoaImpl,
    performance: globalThis.performance ?? { now: () => Date.now() },
    requestAnimationFrame,
    navigator,
    location,
    history,
    window: windowObj,
    document: documentObj,
    HTMLElement
  };

  const scriptSource = scripts.join("\n\n");
  const markerMissing = [];
  for (const m of markers) if (!scriptSource.includes(m)) markerMissing.push(m);

  try {
    const ctx = vm.createContext(sandbox, { name: "sfwa-sandbox" });
    for (let i = 0; i < scripts.length; i++) {
      const code = scripts[i];
      const script = new vm.Script(code, { filename: path.basename(args.html) + `:inline:${i + 1}` });
      script.runInContext(ctx, { timeout: 1000 });
    }
  } catch (e) {
    errors.push("Script threw during execution: " + (e?.stack || String(e)));
  }

  const expectedMissing = [];
  for (const exp of expectedEvents) {
    const found = eventLog.some(ev => ev.target === exp.target && ev.type === exp.type);
    if (!found) expectedMissing.push(`${exp.target}:${exp.type}`);
  }

  const readsOk = expectedHashIO.readsLocationHash ? (hashReads > 0) : true;
  const writesOk = expectedHashIO.writesHash ? (hashWrites > 0) : true;
  const methodsOk = (expectedHashIO.writeMethods || []).every(m => writeMethodsUsed.has(m));
  const bootWriteOk = writesOnBoot ? (hashWrites > 0) : true;

  const ok =
    errors.length === 0 &&
    markerMissing.length === 0 &&
    expectedMissing.length === 0 &&
    readsOk &&
    writesOk &&
    methodsOk &&
    bootWriteOk;

  const out = {
    ok,
    errors: [
      ...errors,
      ...(markerMissing.length ? [`Missing required JS marker(s): ${markerMissing.join(", ")}`] : []),
      ...(expectedMissing.length ? [`Missing required event listener(s): ${expectedMissing.join(", ")}`] : []),
      ...(!readsOk ? ["Expected location.hash to be read at least once."] : []),
      ...(!writesOk ? ["Expected hash to be written at least once."] : []),
      ...(!methodsOk ? ["Expected all required writeMethods to be used: " + (expectedHashIO.writeMethods || []).join(", ")] : []),
      ...(!bootWriteOk ? ["Expected a hash write on boot (writesOnBoot=true)."] : [])
    ],
    details: {
      scriptsExecuted: scripts.length,
      hashReads,
      hashWrites,
      writeMethodsUsed: Array.from(writeMethodsUsed).sort(),
      eventLog,
      markerMissing,
      expectedMissing
    }
  };

  process.stdout.write(JSON.stringify(out, null, 2));
}

main();
