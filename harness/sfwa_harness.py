#!/usr/bin/env python3
"""
sfwa_harness.py - SFWA-ABI v1 compliance harness

Checks HTML compliance and JS compliance separately against a sfwa-abi-1 spec.

Requirements:
  - Python 3.10+
  - Node.js 18+ (used for JS execution harness)
  - lxml (for HTML parsing)

Usage:
  python sfwa_harness.py --spec path/to/app.sfwa-abi.json --html path/to/app.html
  python sfwa_harness.py --spec ... --html ... --mode html
  python sfwa_harness.py --spec ... --html ... --mode js
  python sfwa_harness.py --spec ... --html ... --mode all --json

Exit codes:
  0 = all requested checks passed
  1 = one or more requested checks failed
  2 = harness error (bad inputs, missing node, etc.)
"""
import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Any, Dict, List

from lxml import html as lxml_html

@dataclass
class CheckResult:
    ok: bool
    errors: List[str]
    details: Dict[str, Any]

def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def _xpath_count(doc, xpath: str) -> int:
    return len(doc.xpath(xpath))

def check_html(spec: Dict[str, Any], html_text: str) -> CheckResult:
    errs: List[str] = []
    details: Dict[str, Any] = {}

    try:
        doc = lxml_html.fromstring(html_text)
    except Exception as e:
        return CheckResult(False, [f"HTML parse error: {e}"], {})

    req = (spec.get("html") or {}).get("requires") or {}
    ids: List[str] = req.get("ids") or []
    selectors: List[str] = req.get("selectors") or []
    data_attrs = req.get("dataAttributes") or []

    # ID existence (exactly once)
    missing = []
    dupes = []
    for idv in ids:
        n = _xpath_count(doc, f"//*[@id='{idv}']")
        if n == 0:
            missing.append(idv)
        elif n > 1:
            dupes.append((idv, n))
    if missing:
        errs.append(f"Missing required id(s): {', '.join(missing)}")
    if dupes:
        errs.append("Duplicate id(s) found: " + ", ".join([f"{i} (count={n})" for i, n in dupes]))
    details["requiredIds"] = {"count": len(ids), "missing": missing, "duplicates": dupes}

    # Minimal selector support for the subset used by the generated specs
    sel_missing = []
    unsupported = []
    for sel in selectors:
        sel = sel.strip()
        if sel == "title":
            if _xpath_count(doc, "//title") == 0:
                sel_missing.append(sel)
        elif sel == "meta[charset]":
            if _xpath_count(doc, "//meta[@charset]") == 0:
                sel_missing.append(sel)
        elif sel in ("meta[name='viewport']", 'meta[name="viewport"]'):
            if _xpath_count(doc, "//meta[translate(@name,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='viewport']") == 0:
                sel_missing.append("meta[name='viewport']")
        else:
            unsupported.append(sel)
    if sel_missing:
        errs.append("Missing required selector(s): " + ", ".join(sel_missing))
    details["requiredSelectors"] = {"count": len(selectors), "missing": sel_missing, "unsupported": unsupported}

    # dataAttributes: only enforce if values list is non-empty
    enforced = []
    da_missing = []
    for da in data_attrs:
        name = da.get("name")
        values = da.get("values") or []
        if not name or not values:
            continue
        for v in values:
            xpath = f"//*[@{name}='{v}']"
            if _xpath_count(doc, xpath) == 0:
                da_missing.append(f"{name}={v}")
            else:
                enforced.append(f"{name}={v}")
    if da_missing:
        errs.append("Missing required data-attribute instance(s): " + ", ".join(da_missing))
    details["dataAttributes"] = {"enforced": enforced, "missing": da_missing}

    return CheckResult(ok=(len(errs) == 0), errors=errs, details=details)

def check_js(spec_path: str, html_path: str, node_script_path: str) -> CheckResult:
    # Ensure node is available
    try:
        subprocess.run(["node", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except Exception as e:
        return CheckResult(False, [f"Node.js not available: {e}"], {})

    try:
        p = subprocess.run(
            ["node", node_script_path, "--spec", spec_path, "--html", html_path],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except Exception as e:
        return CheckResult(False, [f"Failed to execute JS harness: {e}"], {})

    if p.returncode == 2:
        return CheckResult(False, ["JS harness internal error:\n" + (p.stderr or p.stdout)], {})
    if not p.stdout.strip():
        return CheckResult(False, ["JS harness produced no output.", p.stderr.strip()], {})

    try:
        payload = json.loads(p.stdout)
    except Exception as e:
        return CheckResult(False, [f"JS harness output was not valid JSON: {e}", p.stdout[:4000]], {"stderr": p.stderr})

    ok = bool(payload.get("ok"))
    errors = payload.get("errors") or ([] if ok else ["JS compliance failed."])
    details = payload.get("details") or {}
    if p.stderr.strip():
        details["stderr"] = p.stderr.strip()

    return CheckResult(ok=ok, errors=errors, details=details)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="Path to sfwa-abi-1 spec JSON.")
    ap.add_argument("--html", required=True, help="Path to HTML file under test.")
    ap.add_argument("--mode", choices=["html", "js", "all"], default="all")
    ap.add_argument("--json", action="store_true", help="Emit machine-readable JSON report.")
    ap.add_argument("--node-harness", default=os.path.join(os.path.dirname(__file__), "sfwa_js_harness.mjs"))
    args = ap.parse_args()

    try:
        spec = _read_json(args.spec)
    except Exception as e:
        print(f"Error: cannot read spec: {e}", file=sys.stderr)
        sys.exit(2)

    if spec.get("abi") != "sfwa-abi-1":
        print(f"Error: unsupported abi '{spec.get('abi')}'. Expected 'sfwa-abi-1'.", file=sys.stderr)
        sys.exit(2)

    try:
        html_text = _read_text(args.html)
    except Exception as e:
        print(f"Error: cannot read HTML file: {e}", file=sys.stderr)
        sys.exit(2)

    report: Dict[str, Any] = {
        "abi": spec.get("abi"),
        "contractId": spec.get("contractId"),
        "source": {"spec": args.spec, "html": args.html},
        "results": {}
    }

    overall_ok = True

    if args.mode in ("html", "all"):
        r = check_html(spec, html_text)
        report["results"]["html"] = {"ok": r.ok, "errors": r.errors, "details": r.details}
        overall_ok = overall_ok and r.ok

    if args.mode in ("js", "all"):
        r = check_js(args.spec, args.html, args.node_harness)
        report["results"]["js"] = {"ok": r.ok, "errors": r.errors, "details": r.details}
        overall_ok = overall_ok and r.ok

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"SFWA Harness Report: {report['contractId']}")
        if "html" in report["results"]:
            h = report["results"]["html"]
            print(f"  HTML: {'PASS' if h['ok'] else 'FAIL'}")
            for e in h["errors"]:
                print(f"    - {e}")
        if "js" in report["results"]:
            j = report["results"]["js"]
            print(f"  JS:   {'PASS' if j['ok'] else 'FAIL'}")
            for e in j["errors"]:
                print(f"    - {e}")
        print("Overall: " + ("PASS" if overall_ok else "FAIL"))

    sys.exit(0 if overall_ok else 1)

if __name__ == "__main__":
    main()
