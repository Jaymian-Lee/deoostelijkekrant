#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from datetime import datetime

INJECTION_PATTERNS = [
    r"ignore\s+previous\s+instructions",
    r"system\s*:",
    r"developer\s*:",
    r"do\s+not\s+follow",
    r"voer\s+uit",
    r"run\s+command",
]
FIELD_PATTERNS = {
    "minecraftNaam": r"minecraft\s*naam\s*:\s*(.+)",
    "onderwerp": r"onderwerp\s*:\s*(.+)",
    "gebeurtenis": r"wat\s+is\s+er\s+gebeurd\s*:\s*(.+)",
    "wanneer": r"wanneer\s*:\s*(.+)",
    "anoniem": r"anoniem\s+publiceren\s*:\s*(.+)",
}

def sanitize(text:str)->str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", text)
    return text[:8000]

def parse_fields(text:str)->dict:
    out = {}
    for key,pat in FIELD_PATTERNS.items():
        m = re.search(pat, text, flags=re.IGNORECASE)
        out[key] = m.group(1).strip() if m else ""
    ano = out.get("anoniem", "").lower()
    out["anoniem"] = ano.startswith("j") or ano.startswith("y")
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    raw = Path(args.input).read_text(encoding="utf-8", errors="ignore")
    clean = sanitize(raw)
    flags = [p for p in INJECTION_PATTERNS if re.search(p, clean, flags=re.IGNORECASE)]
    fields = parse_fields(clean)

    record = {
        "datum": datetime.now().strftime("%Y-%m-%d"),
        "onderwerp": fields.get("onderwerp") or "Onbekend onderwerp",
        "minecraftNaam": fields.get("minecraftNaam") or "",
        "anoniem": bool(fields.get("anoniem")),
        "samenvatting": (fields.get("gebeurtenis") or "")[:500],
        "wanneer": fields.get("wanneer") or "",
        "status": "Nieuw",
        "veiligheidsFlags": {
            "promptInjectieVerdacht": bool(flags),
            "triggers": flags,
        },
        "validatie": {
            "heeftMinecraftNaam": bool(fields.get("minecraftNaam")),
            "heeftOnderwerp": bool(fields.get("onderwerp")),
            "heeftGebeurtenis": bool(fields.get("gebeurtenis")),
        },
        "rawFragment": clean[:1200],
    }

    Path(args.output).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(args.output)

if __name__ == "__main__":
    main()
