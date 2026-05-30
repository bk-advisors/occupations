"""Build causes.json, causes-by-age.csv, parent-ids.csv from raw IHME GBD CSV.

Skeleton — fill in the column names once the actual GBD download is in hand.
The GBD CSV columns differ slightly between Results Tool exports and direct
API pulls; this script assumes the Results Tool flat export.

Usage:
    python _build_data.py raw/IHME-GBD_2021_AFR.csv

Expected raw columns (Results Tool flat CSV):
    measure_name, location_name, sex_name, age_name, cause_name,
    metric_name, year, val, upper, lower

Output files are written next to this script.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent

# Map GBD age labels to our 5-band scheme.
AGE_MAP = {
    "<5 years": "<5",
    "Under 5": "<5",
    "5-14 years": "5-14",
    "15-49 years": "15-49",
    "50-69 years": "50-69",
    "70+ years": "70+",
}

# Hierarchy mapping from GBD cause names to our (L1, L2) parents.
# Fill this in once you've inspected the actual raw CSV — the names below are
# the ones used in the placeholder data and may need adjusting to match GBD's
# exact strings.
HIERARCHY: dict[str, tuple[str, str]] = {
    # cause_name (L3 leaf) -> (L1 parent, L2 parent)
    "HIV/AIDS": ("Communicable, maternal, neonatal & nutritional",
                 "HIV/AIDS & sexually transmitted infections"),
    "Tuberculosis": ("Communicable, maternal, neonatal & nutritional",
                     "Respiratory infections & tuberculosis"),
    "Malaria": ("Communicable, maternal, neonatal & nutritional",
                "Malaria & neglected tropical diseases"),
    # ... extend to all leaves you want to show
}


def main(raw_path: Path) -> None:
    rows = list(csv.DictReader(raw_path.open()))

    # Group deaths by (L3 cause, age_band).
    by_leaf: dict[tuple[str, str], float] = defaultdict(float)
    for r in rows:
        if r["measure_name"] != "Deaths": continue
        if r["metric_name"] != "Number": continue
        age = AGE_MAP.get(r["age_name"])
        if age is None: continue
        leaf = r["cause_name"]
        if leaf not in HIERARCHY: continue
        by_leaf[(leaf, age)] += float(r["val"])

    # Build the hierarchical tree.
    l1_index: dict[str, dict] = {}
    l2_index: dict[tuple[str, str], dict] = {}
    leaf_id: dict[str, str] = {}
    l1_counter = 0
    l2_counters: dict[str, int] = defaultdict(int)
    l3_counters: dict[tuple[str, str], int] = defaultdict(int)

    for leaf, (l1_name, l2_name) in HIERARCHY.items():
        if l1_name not in l1_index:
            l1_counter += 1
            l1_index[l1_name] = {
                "name": l1_name, "_id": str(l1_counter), "children": []
            }
        l1 = l1_index[l1_name]
        if (l1_name, l2_name) not in l2_index:
            l2_counters[l1_name] += 1
            l2 = {"name": l2_name,
                  "_id": f"{l1['_id']}.{l2_counters[l1_name]}",
                  "children": []}
            l2_index[(l1_name, l2_name)] = l2
            l1["children"].append(l2)
        l2 = l2_index[(l1_name, l2_name)]
        l3_counters[(l1_name, l2_name)] += 1
        leaf_id[leaf] = f"{l2['_id']}.{l3_counters[(l1_name, l2_name)]}"
        size = sum(by_leaf[(leaf, a)] for a in AGE_MAP.values() if (leaf, a) in by_leaf)
        l2["children"].append({"name": leaf, "ID": leaf_id[leaf], "size": round(size)})

    # Strip internal _id from non-leaf dicts before serialisation.
    def strip(node: dict) -> dict:
        n = {"name": node["name"]}
        if "ID" in node:
            n["ID"] = node["ID"]
            n["size"] = node["size"]
        if "children" in node:
            n["children"] = [strip(c) for c in node["children"]]
        return n

    tree = {"name": "All causes",
            "children": [strip(l1) for l1 in l1_index.values()]}

    (HERE / "causes.json").write_text(json.dumps(tree, indent=2))

    # Flat by-age CSV.
    with (HERE / "causes-by-age.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ID", "age", "value"])
        for leaf, lid in leaf_id.items():
            for age in ["<5", "5-14", "15-49", "50-69", "70+"]:
                w.writerow([lid, age, round(by_leaf.get((leaf, age), 0))])

    # Parent-ID lookup.
    with (HERE / "parent-ids.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "ID"])
        w.writerow(["All causes", ""])
        for l1 in l1_index.values():
            w.writerow([l1["name"], l1["_id"]])
        for (l1_name, l2_name), l2 in l2_index.items():
            w.writerow([l2_name, l2["_id"]])

    print(f"Wrote {len(leaf_id)} leaves across {len(l1_index)} L1 / {len(l2_index)} L2.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python _build_data.py raw/<gbd-export>.csv")
    main(Path(sys.argv[1]))
