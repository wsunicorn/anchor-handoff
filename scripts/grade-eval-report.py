"""Đọc eval/out/essays/*.json (từ scripts/grade-eval.sh), kiểm tiêu chí thoát G5 và in bảng."""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys

rows: list[tuple[str, ...]] = []
bad = 0
for f in sorted(glob.glob("eval/out/essays/*.json")):
    with open(f, encoding="utf-8") as fh:
        d = json.load(fh)
    base = os.path.basename(f)[:-5]
    if "code" in d:
        rows.append((base, "LỖI " + d["code"], "", "", ""))
        bad += 1
        continue
    fb = d["feedback"]
    shown = fb["comments"]
    ids = sorted({c["citation"]["chunk_id"] for c in shown})
    ok_cite = True
    if ids:
        q = "select count(*) from chunks where id in (" + ",".join("'" + i + "'" for i in ids) + ")"
        n = int(
            subprocess.check_output(
                ["docker", "exec", "supabase_db_anchor-handoff", "psql", "-U", "postgres", "-tAc", q]
            )
            .decode()
            .strip()
        )
        ok_cite = n == len(ids)
    lvl3 = [c for c in shown if c["verdict"] == "unsupported"]
    if not ok_cite or lvl3 or not shown:
        bad += 1
    rows.append(
        (
            base,
            f"{d['raw_comments']} thô → {len(shown)} hiện / {fb['omitted']} ẩn",
            "citation ✓" if ok_cite else "citation ✗",
            f"mức3 lọt: {len(lvl3)}",
            ", ".join(f"{c['name']}={c['level']}" for c in fb["criteria"]),
        )
    )
for r in rows:
    print(" | ".join(r))
print("\nKẾT LUẬN:", "ĐẠT" if bad == 0 else f"CHƯA ĐẠT ({bad} bài)")
sys.exit(0 if bad == 0 else 1)
