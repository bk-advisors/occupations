"""Reshape WHO Global Health Estimates 2021 → app-ready ES modules.

Input:  raw/ghe2021_deaths_whoregion.xlsx, sheet `AFR 2021`
Output: ../src/data/causes.js        (hierarchical tree)
        ../src/data/causesByAge.js  (flat by-age values)
        ../src/data/meta.js          (totals + provenance)

Run:    python _build_data.py
        (no args — paths are hard-coded relative to this file)

Citation: Global Health Estimates 2021: Deaths by Cause, Age, Sex, by Country
and by Region, 2000-2021. Geneva, World Health Organization; 2024.
Licence: CC BY-NC-SA 3.0 IGO.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "raw" / "ghe2021_deaths_whoregion.xlsx"
OUT_DIR = HERE.parent / "src" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# The standalone exploration tool also consumes this data, but via XHR rather
# than as ES modules. Mirror outputs into its data folder if it exists.
TOOL_DATA_DIR = HERE.parent.parent / "africa-causes-of-death-2021" / "data"

# WHO uses ~9 lines of metadata before the data table. The first two body
# rows are headers we want to ignore (the age-band/sex column labels live
# above row 9 but we know the layout from the agent's inspection).
SHEET = "AFR 2021"

# Column layout for the AFR 2021 sheet, confirmed by direct inspection.
# Marker columns hold "I."/"A."/"1."/"a." prefixes; the column immediately
# to the right holds the name. So depth = position of the marker.
#   0  Code (numeric, encodes hierarchy ordering)
#   1  L1 marker      ("I." / "II." / "III.")
#   2  L1 name        OR L2 marker ("A." / "B." / ...)
#   3  L2 name        OR L3 marker ("1." / "2." / ...)
#   4  L3 name        OR L4 marker ("a." / "b." / ...)
#   5  L4 name
#   6  Total all ages (both sexes)
#   7  Male  — all ages
#   8  Female — all ages
#   9..16  Male  by age: 0-28d, 1-59m, 5-14, 15-29, 30-49, 50-59, 60-69, 70+
#   17..24 Female by age: same bands
COL_CODE = 0
COL_MARKER_BASE = 1   # L1 marker column; deeper levels increment by 1
COL_TOTAL_BOTH = 6
MALE_AGE_COLS   = list(range(9, 17))    # 8 columns
FEMALE_AGE_COLS = list(range(17, 25))   # 8 columns
AGE_LABELS = ["0-28d", "1-59m", "5-14", "15-29", "30-49", "50-59", "60-69", "70+"]

# Collapse WHO's 8 bands into the 5-band scheme the viz uses.
AGE_COLLAPSE = {
    "<5":    ["0-28d", "1-59m"],
    "5-14":  ["5-14"],
    "15-49": ["15-29", "30-49"],
    "50-69": ["50-59", "60-69"],
    "70+":   ["70+"],
}
TARGET_AGES = ["<5", "5-14", "15-49", "50-69", "70+"]


def _read_sheet() -> pd.DataFrame:
    df = pd.read_excel(RAW, sheet_name=SHEET, header=None)
    # Discover the data-start row by finding the first row whose first column
    # is a number (the WHO code). Metadata rows have strings or NaN there.
    data_start = next(
        i for i in range(len(df))
        if pd.notna(df.iat[i, COL_CODE]) and isinstance(df.iat[i, COL_CODE], (int, float))
    )
    df = df.iloc[data_start:].reset_index(drop=True)
    # Cast code to int for consistent ordering.
    df[COL_CODE] = pd.to_numeric(df[COL_CODE], errors="coerce")
    return df


import re
_MARKER_RE = re.compile(r"^[IVX]+\.$|^[A-Z]\.$|^[0-9]+\.$|^[a-z]\.$")


def _classify_level(row: pd.Series) -> tuple[int, str] | None:
    """Return (depth, name) for a data row, or None for headers/blanks.

    Depth = column index of the marker minus the L1-marker column.
    Name  = value in the column immediately to the right of the marker.
    """
    for offset in range(4):  # depths 1, 2, 3, 4
        marker_col = COL_MARKER_BASE + offset
        name_col = marker_col + 1
        v = row[marker_col]
        if pd.notna(v) and isinstance(v, str) and _MARKER_RE.match(v.strip()):
            name = row[name_col]
            if pd.notna(name):
                return (offset + 1, str(name).strip())
    return None


def _row_value_by_age(row: pd.Series) -> dict[str, float]:
    """Sum male + female for each of the 8 WHO age columns, then collapse
    into the 5-band target scheme."""
    by_who_age = {}
    for label, mc, fc in zip(AGE_LABELS, MALE_AGE_COLS, FEMALE_AGE_COLS):
        m = float(row[mc]) if pd.notna(row[mc]) else 0.0
        f = float(row[fc]) if pd.notna(row[fc]) else 0.0
        by_who_age[label] = m + f
    out = {}
    for target, sources in AGE_COLLAPSE.items():
        out[target] = sum(by_who_age[s] for s in sources)
    return out


def main() -> None:
    df = _read_sheet()

    # First propagate parent labels forward — when we walk a row deeper than
    # L1, we still want to know which L1 it belongs to. WHO leaves those
    # cells empty after the first occurrence, so we forward-fill manually
    # but ONLY at the levels above the current row's classification level
    # (otherwise we'd overwrite a real label with a stale one).
    last_label = {1: None, 2: None, 3: None, 4: None}
    rows: list[dict] = []
    for _, r in df.iterrows():
        cl = _classify_level(r)
        if cl is None:
            continue
        depth, name = cl
        # Update the label for the current depth and clear deeper ones.
        last_label[depth] = name
        for d in range(depth + 1, 5):
            last_label[d] = None

        rows.append({
            "code": int(r[COL_CODE]),
            "depth": depth,
            "l1": last_label[1],
            "l2": last_label[2] if depth >= 2 else None,
            "l3": last_label[3] if depth >= 3 else None,
            "l4": last_label[4] if depth >= 4 else None,
            "name": name,
            "total": float(r[COL_TOTAL_BOTH]) if pd.notna(r[COL_TOTAL_BOTH]) else 0.0,
            "by_age": _row_value_by_age(r),
        })

    # Drop any "All Causes" row if present (depth 0 / NaN classification we
    # already skipped, but some WHO sheets label the top as a depth-1 with a
    # specific name). We can detect it as the row with depth 1 that contains
    # "All Causes" in any label cell.
    # In practice the AFR 2021 sheet starts directly at the three Level 1
    # buckets, so this is a no-op.

    # ── Build the hierarchical tree ──────────────────────────────────────────
    # We keep depths 1, 2, 3 in the tree (L4 collapsed up to L3 — too much
    # noise for the circle pack). L3 rows become leaves with a `size` and a
    # cached `byAge` array. L1 and L2 rows are branches; their `size` is
    # derived by summing their leaves so we don't double-count.

    # The WHO taxonomy is uneven: some causes (HIV, TB, COVID-19, Preterm
    # birth complications) sit at L3; others (Malaria, Measles,
    # Schistosomiasis) sit at L4 under a generic L3 bucket like "Parasitic
    # and vector diseases". For the viz to surface narratively important
    # causes, we expand L4 → leaves whenever an L3 has L4 children, and
    # demote that L3 to a pure grouping branch (no size of its own; its
    # children carry the values).
    #
    # First pass: collect L3s that have at least one L4 child.
    l3s_with_l4 = {
        (r["l1"], r["l2"], r["l3"]) for r in rows if r["depth"] == 4
    }

    leaves: dict[tuple[str, ...], dict] = {}

    for r in rows:
        if r["depth"] == 3 and (r["l1"], r["l2"], r["l3"]) not in l3s_with_l4:
            # L3 with no L4 children → L3 is the leaf.
            key = (r["l1"], r["l2"], r["l3"])
            leaves[key] = {
                "code": r["code"],
                "depth": 3,
                "parents": (r["l1"], r["l2"]),
                "l3_group": None,
                "name": r["l3"],
                "size": r["total"],
                "by_age": dict(r["by_age"]),
            }
        elif r["depth"] == 4:
            # L4 row → emit as leaf; L3 becomes a grouping container.
            key = (r["l1"], r["l2"], r["l3"], r["l4"])
            leaves[key] = {
                "code": r["code"],
                "depth": 4,
                "parents": (r["l1"], r["l2"]),
                "l3_group": r["l3"],
                "name": r["l4"],
                "size": r["total"],
                "by_age": dict(r["by_age"]),
            }
        # L1 and L2 rows: ignored here — totals derived from leaves.

    # Drop leaves with zero deaths — they add noise without information.
    leaves = {k: v for k, v in leaves.items() if v["size"] > 0}

    # Build IDs in our prefix-encoded scheme (1.2.3.4 etc.) for the viz's
    # zoom-by-prefix logic. Numbering is by code order within each parent.
    tree = {"name": "All causes", "children": []}
    age_rows: list[dict] = []  # flat by-age table

    l1_index: dict[str, dict] = {}
    l2_index: dict[tuple[str, str], dict] = {}
    l3_group_index: dict[tuple[str, str, str], dict] = {}  # only when L3 is a grouping
    l1_n = 0
    l2_n: dict[str, int] = {}
    child_n: dict[str, int] = {}  # keyed by parent ID

    def _child_id(parent_id: str) -> str:
        child_n[parent_id] = child_n.get(parent_id, 0) + 1
        return f"{parent_id}.{child_n[parent_id]}"

    for key, leaf in sorted(leaves.items(), key=lambda kv: kv[1]["code"]):
        l1, l2 = leaf["parents"]
        # Ensure L1 node exists.
        if l1 not in l1_index:
            l1_n += 1
            node = {"name": l1, "ID": str(l1_n), "children": []}
            l1_index[l1] = node
            tree["children"].append(node)
        # Ensure L2 node exists.
        if (l1, l2) not in l2_index:
            l2_n[l1] = l2_n.get(l1, 0) + 1
            node = {"name": l2, "ID": f"{l1_index[l1]['ID']}.{l2_n[l1]}", "children": []}
            l2_index[(l1, l2)] = node
            l1_index[l1]["children"].append(node)

        # Determine the immediate parent of this leaf.
        if leaf["depth"] == 4:
            l3_grp = leaf["l3_group"]
            grp_key = (l1, l2, l3_grp)
            if grp_key not in l3_group_index:
                grp_id = _child_id(l2_index[(l1, l2)]["ID"])
                grp = {"name": l3_grp, "ID": grp_id, "children": []}
                l3_group_index[grp_key] = grp
                l2_index[(l1, l2)]["children"].append(grp)
            parent_node = l3_group_index[grp_key]
        else:
            parent_node = l2_index[(l1, l2)]

        leaf_id = _child_id(parent_node["ID"])
        parent_node["children"].append({
            "name": leaf["name"],
            "ID": leaf_id,
            "size": round(leaf["size"]),
            "code": leaf["code"],
        })
        for age in TARGET_AGES:
            age_rows.append({
                "ID": leaf_id,
                "age": age,
                "value": round(leaf["by_age"].get(age, 0)),
            })

    # ── Compute totals for the meta module ──────────────────────────────────
    total_deaths = sum(leaf["size"] for leaf in leaves.values())
    total_by_age = {age: 0.0 for age in TARGET_AGES}
    for leaf in leaves.values():
        for age in TARGET_AGES:
            total_by_age[age] += leaf["by_age"].get(age, 0)
    total_by_l1 = {}
    for key, leaf in leaves.items():
        l1 = leaf["parents"][0]
        total_by_l1[l1] = total_by_l1.get(l1, 0) + leaf["size"]

    meta = {
        "source": "WHO Global Health Estimates 2021",
        "citation": "Global Health Estimates 2021: Deaths by Cause, Age, Sex, by Country and by Region, 2000-2021. Geneva, World Health Organization; 2024.",
        "licence": "CC BY-NC-SA 3.0 IGO",
        "url": "https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-leading-causes-of-death",
        "year": 2021,
        "region": "WHO African Region (AFR)",
        "regionNote": "47 countries. Excludes North African countries assigned to the Eastern Mediterranean Region (Egypt, Tunisia, Libya, Morocco, Sudan, Somalia, Djibouti).",
        "totalDeaths": round(total_deaths),
        "totalByAge": {a: round(v) for a, v in total_by_age.items()},
        "totalByL1": {k: round(v) for k, v in total_by_l1.items()},
        "ageBands": TARGET_AGES,
    }

    # ── Write ES modules ────────────────────────────────────────────────────
    (OUT_DIR / "causes.js").write_text(
        "// Auto-generated by data/_build_data.py — do not edit by hand.\n"
        "// Source: WHO GHE 2021, AFR region. See ../../data/_build_data.py.\n\n"
        "export const causes = " + json.dumps(tree, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    (OUT_DIR / "causesByAge.js").write_text(
        "// Auto-generated by data/_build_data.py — do not edit by hand.\n\n"
        "export const causesByAge = " + json.dumps(age_rows, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    (OUT_DIR / "meta.js").write_text(
        "// Auto-generated by data/_build_data.py — do not edit by hand.\n\n"
        "export const meta = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    # ── Also emit the same data for the standalone exploration tool ────────
    # (apps/africa-causes-of-death-2021/) uses XHR + d3.csv()/d3.json() so the
    # shapes are: causes.json (tree), causes-by-age.csv (flat), parent-ids.csv.
    if TOOL_DATA_DIR.exists():
        import csv
        (TOOL_DATA_DIR / "causes.json").write_text(
            json.dumps(tree, indent=2, ensure_ascii=False), encoding="utf-8")
        with (TOOL_DATA_DIR / "causes-by-age.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["ID", "age", "value"])
            for r in age_rows:
                w.writerow([r["ID"], r["age"], r["value"]])
        # Parent-ID lookup: every non-leaf node (root + L1 + L2 + L3 grouping).
        with (TOOL_DATA_DIR / "parent-ids.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["name", "ID"])
            w.writerow(["All causes", ""])
            for l1 in l1_index.values():
                w.writerow([l1["name"], l1["ID"]])
            for l2 in l2_index.values():
                w.writerow([l2["name"], l2["ID"]])
            for grp in l3_group_index.values():
                w.writerow([grp["name"], grp["ID"]])
        # And the meta — useful for the tool's footer too.
        (TOOL_DATA_DIR / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Also wrote tool data to {TOOL_DATA_DIR}")

    print(f"Wrote {len(leaves)} L3 leaves under {len(l1_index)} L1 / {len(l2_index)} L2 groups.")
    print(f"Total deaths (AFR 2021): {round(total_deaths):,}")
    print(f"By age:")
    for age in TARGET_AGES:
        print(f"  {age:>6}: {round(total_by_age[age]):>12,}")
    print(f"By L1:")
    for l1, v in total_by_l1.items():
        print(f"  {round(v):>12,}  {l1}")


if __name__ == "__main__":
    main()
