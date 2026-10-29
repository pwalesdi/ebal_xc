#!/usr/bin/env python3
"""Read-only audit of the CSVs in assets/data/.

Prints a plain-text report, sections a to j, and changes nothing:

    python3 tools/audit_data.py
"""

import codecs
import csv
import io
import re
import textwrap
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
LAST_YEAR = 2025
TOP_N = 21
GENDERS = ("girls", "boys")

TEAM = "ebal_xc_{}_team_results.csv"
TOP21 = "ebal_xc_{}_top21.csv"
CHAMPIONS = "ebal_xc_{}_team_champions.csv"
LOG = "ebal_xc_coverage_log.csv"

# No separate schema came with the data, so the expected headers are the ones
# the files had at import. Section a reports any drift from them.
TEAM_HEADER = ["year", "meet_date", "venue", "distance", "team_place", "school", "team_score", "source_url"]
TOP21_HEADER = ["year", "meet_date", "venue", "distance", "place", "athlete", "grade", "school", "time", "source_url"]
LOG_HEADER = ["year", "gender", "status", "source_used", "sources_tried", "notes"]
CHAMPIONS_HEADER = ["year", "school", "shared_title", "source", "status"]

EXPECTED = {
    TEAM.format("girls"): TEAM_HEADER,
    TEAM.format("boys"): TEAM_HEADER,
    TOP21.format("girls"): TOP21_HEADER,
    TOP21.format("boys"): TOP21_HEADER,
    LOG: LOG_HEADER,
    CHAMPIONS.format("girls"): CHAMPIONS_HEADER,
    CHAMPIONS.format("boys"): CHAMPIONS_HEADER,
}

# The four results files in report column order, with their short labels.
RESULTS = {
    TEAM.format("girls"): "girls team",
    TOP21.format("girls"): "girls top21",
    TEAM.format("boys"): "boys team",
    TOP21.format("boys"): "boys top21",
}

YEAR_RE = re.compile(r"[0-9]{4}")
NUMBER_RE = re.compile(r"[0-9]+")
SCORE_RE = re.compile(r"([0-9]+)\*?")  # some sources print a tied score as 139*
TIME_RE = re.compile(r"[0-9]+:[0-5][0-9](\.[0-9]{1,2})?")


def load(name):
    """Reads one CSV into a dict, or returns None if the file is missing."""
    path = DATA / name
    if not path.exists():
        return None
    raw = path.read_bytes()
    try:
        text, valid_utf8 = raw.decode("utf-8-sig"), True
    except UnicodeDecodeError:
        text, valid_utf8 = raw.decode("utf-8-sig", errors="replace"), False
    reader = csv.reader(io.StringIO(text, newline=""))
    header = next(reader, [])
    rows, last_line = [], reader.line_num
    for fields in reader:
        line, last_line = last_line + 1, reader.line_num
        if not fields:
            continue
        row = {col: fields[i] if i < len(fields) else "" for i, col in enumerate(header)}
        row["_line"], row["_fields"] = line, fields
        rows.append(row)
    return {
        "name": name,
        "header": header,
        "rows": rows,
        "bom": raw.startswith(codecs.BOM_UTF8),
        "crlf": b"\r\n" in raw,
        "valid_utf8": valid_utf8,
    }


def rows_of(tables, name):
    table = tables.get(name)
    return table["rows"] if table else []


def year_of(row):
    year = row.get("year", "")
    return int(year) if YEAR_RE.fullmatch(year) else None


def by_year(rows):
    grouped = defaultdict(list)
    for row in rows:
        if year_of(row) is not None:
            grouped[year_of(row)].append(row)
    return dict(sorted(grouped.items()))


def number(value):
    """Returns a whole number of at least 1, or None."""
    return int(value) if NUMBER_RE.fullmatch(value) and int(value) >= 1 else None


def spans(numbers):
    """[1, 2, 3, 5] -> '1-3, 5'."""
    numbers = sorted(set(numbers))
    out, i = [], 0
    while i < len(numbers):
        j = i
        while j + 1 < len(numbers) and numbers[j + 1] == numbers[j] + 1:
            j += 1
        out.append(str(numbers[i]) if i == j else f"{numbers[i]}-{numbers[j]}")
        i = j + 1
    return ", ".join(out)


def year_list(seen):
    """{year: {results file, ...}} -> '2008-2009, 2012 (boys team), 2013'.

    Years found in all four results files are spanned; any other year names
    the files it was found in.
    """
    parts, run = [], []
    for year in sorted(seen):
        if len(seen[year]) == len(RESULTS):
            run.append(year)
            continue
        if run:
            parts.append(spans(run))
            run = []
        labels = ", ".join(label for name, label in RESULTS.items() if name in seen[year])
        parts.append(f"{year} ({labels})")
    if run:
        parts.append(spans(run))
    return ", ".join(parts)


def quote(value):
    return f'"{value}"'


def say(text, indent="   ", hang=True):
    """Prints text wrapped at 96 columns, continuation lines hanging unless hang=False."""
    print(textwrap.fill(text, width=96, initial_indent=indent,
                        subsequent_indent=indent + "   " if hang else indent))


def header_diff(expected, actual):
    if actual == expected:
        return "matches expected"
    swapped = [(e, a) for e, a in zip(expected, actual) if e != a and e not in actual and a not in expected]
    notes = [f"{quote(a)} where {quote(e)} was expected" for e, a in swapped]
    notes += [f"missing {quote(c)}" for c in expected if c not in actual and c not in dict(swapped)]
    notes += [f"extra {quote(c)}" for c in actual if c not in expected and c not in {a for _, a in swapped}]
    notes += [f"duplicate {quote(c)}" for c, n in Counter(actual).items() if n > 1]
    return "; ".join(notes) or "same columns, different order"


def header_check(tables):
    print("a. Header check")
    say("Expected headers are pinned in tools/audit_data.py. No separate schema came with the "
        "data, so they are the headers the files had at import. Each file's actual header is "
        "printed below so it can be checked against the intended schema.", hang=False)
    present = [t for t in tables.values() if t]
    for name, expected in EXPECTED.items():
        table = tables[name]
        if table is None:
            print(f"   {name}: MISSING")
            continue
        print(f"   {name} ({len(table['rows'])} rows): {header_diff(expected, table['header'])}")
        print(f"      {','.join(table['header'])}")

    differ = [p for p in (TEAM, TOP21, CHAMPIONS)
              if tables[p.format("girls")] and tables[p.format("boys")]
              and tables[p.format("girls")]["header"] != tables[p.format("boys")]["header"]]
    say("Girls and boys counterparts: "
        + ("headers differ for " + ", ".join(p.format("girls/boys") for p in differ) if differ
           else "identical headers"))

    print("   Records whose field count differs from the header:")
    ragged = [(t, r) for t in present for r in t["rows"] if len(r["_fields"]) != len(t["header"])]
    for t, r in ragged:
        context = " ".join(v for v in (r.get("year", ""), r.get("gender", "")) if v)
        print(f"      {t['name']} line {r['_line']} ({context}): "
              f"{len(r['_fields'])} fields, header has {len(t['header'])}")
    if not ragged:
        print("      none")

    print('   Values that contain "" (two double quotes in a row) after parsing:')
    doubled = [(t, r, i) for t in present for r in t["rows"]
               for i, value in enumerate(r["_fields"]) if '""' in value]
    for t, r, i in doubled:
        column = t["header"][i] if i < len(t["header"]) else f"field {i + 1}"
        print(f"      {t['name']} line {r['_line']}, {column}")
    if not doubled:
        print("      none")

    bad_years = [f"{t['name']} line {r['_line']}: {quote(r.get('year', ''))}"
                 for t in present for r in t["rows"] if year_of(r) is None]
    say("Years that aren't four digits: " + ("; ".join(bad_years) or "none"))
    say("Byte order mark: " + (", ".join(t["name"] for t in present if t["bom"]) or "none"))
    say("Invalid UTF-8: " + (", ".join(t["name"] for t in present if not t["valid_utf8"]) or "none"))
    say("CRLF line endings: " + (", ".join(t["name"] for t in present if t["crlf"]) or "none")
        + ". LF: " + (", ".join(t["name"] for t in present if not t["crlf"]) or "none") + ".")


def coverage_table(tables):
    years = [year_of(r) for t in tables.values() if t for r in t["rows"]]
    years = [y for y in years if y is not None]
    if not years:
        print("b. Coverage: no years found")
        return
    first, last = min(years), max(years + [LAST_YEAR])
    teams = {g: by_year(rows_of(tables, TEAM.format(g))) for g in GENDERS}
    top = {g: by_year(rows_of(tables, TOP21.format(g))) for g in GENDERS}
    log = defaultdict(list)
    for row in rows_of(tables, LOG):
        log[(year_of(row), row.get("gender", ""))].append(row.get("status", ""))

    print(f"b. Coverage, {first}-{last}")
    print("   team: Y/N and number of teams. top21: number of places present.")
    print("   log: coverage_log status, or - where the log has no row.")
    print()
    line = "   {:<4}  {:<10}  {:<11}  {:<9}  {:<10}  {:<10}  {}"
    print(line.format("year", "girls team", "girls top21", "boys team", "boys top21", "girls log", "boys log"))
    for year in range(first, last + 1):
        cells = []
        for g in GENDERS:
            count = len(teams[g].get(year, []))
            cells.append(f"Y {count}" if count else "N")
            cells.append(len({number(r.get("place", "")) for r in top[g].get(year, [])} - {None}))
        cells += ["/".join(log.get((year, g), [])) or "-" for g in GENDERS]
        print(line.format(year, *cells))


def top21_check(tables):
    print("c. Top-21 integrity")
    checked = {g: by_year(rows_of(tables, TOP21.format(g))) for g in GENDERS}
    print("   Years checked: " + "; ".join(f"{g} {spans(checked[g])}" for g in GENDERS))
    found = False
    for g in GENDERS:
        for year, rows in checked[g].items():
            counts = Counter(number(r.get("place", "")) for r in rows)
            bad = [r.get("place", "") for r in rows if number(r.get("place", "")) is None]
            counts.pop(None, None)
            problems = []
            missing = set(range(1, TOP_N + 1)) - set(counts)
            if missing:
                problems.append(f"missing places {spans(missing)}")
            dupes = sorted(p for p, n in counts.items() if n > 1)
            if dupes:
                problems.append("duplicate places " + ", ".join(map(str, dupes)))
            above = sorted(p for p in counts if p > TOP_N)
            if above:
                problems.append(f"places above {TOP_N}: " + ", ".join(map(str, above)))
            if bad:
                problems.append("places that aren't whole numbers: " + ", ".join(map(quote, bad)))
            for r in rows:
                empty = [col for col in ("athlete", "time") if not r.get(col, "").strip()]
                if empty:
                    problems.append(f"line {r['_line']} (place {r.get('place', '')}) has an empty "
                                    + " and ".join(empty))
            if problems:
                found = True
                say(f"{g} {year}: " + "; ".join(problems))
    if not found:
        say(f"none: every year has places 1-{TOP_N} once each, nothing above {TOP_N}, "
            "and every row has an athlete and a time.")


def team_check(tables):
    print("d. Team integrity")
    checked = {g: by_year(rows_of(tables, TEAM.format(g))) for g in GENDERS}
    print("   Years checked: " + "; ".join(f"{g} {spans(checked[g])}" for g in GENDERS))
    found = False
    marked = defaultdict(list)  # (gender, year, score as written) -> places
    for g in GENDERS:
        for year, rows in checked[g].items():
            problems = []
            places = Counter(r.get("team_place", "") for r in rows)
            dupes = [p for p, n in places.items() if n > 1]
            if dupes:
                problems.append("duplicate team places " + ", ".join(dupes))
            bad = [p for p in places if number(p) is None]
            if bad:
                problems.append("team places that aren't whole numbers: " + ", ".join(map(quote, bad)))
            previous = None
            for r in sorted((r for r in rows if number(r.get("team_place", ""))),
                            key=lambda r: number(r["team_place"])):
                written = r.get("team_score", "")
                match = SCORE_RE.fullmatch(written)
                if not NUMBER_RE.fullmatch(written):
                    marked[(g, year, written)].append(r["team_place"])
                if not match:
                    continue
                score = int(match.group(1))
                if previous and score < previous[1]:
                    problems.append(f"place {r['team_place']} scores {written}, "
                                    f"below place {previous[0]}'s {previous[2]}")
                previous = (r["team_place"], score, written)
            if problems:
                found = True
                say(f"{g} {year}: " + "; ".join(problems))
    if not found:
        say("none: no duplicate team places, and scores never drop as place rises.")
    print("   Scores that aren't plain whole numbers (a trailing * is compared on its number;")
    print("   anything else is left out of the order check):")
    for (g, year, written), places in marked.items():
        print(f"      {g} {year} places {', '.join(places)}: {quote(written)}")
    if not marked:
        print("      none")


def champion_check(tables):
    print("e. Champion cross-check: team_place 1 in team results vs the champions CSV")
    print("   Exact strings. Years compared are those with both a team_place 1 and a named champion.")
    mismatches = []
    for g in GENDERS:
        winners, champions = defaultdict(list), defaultdict(list)
        for r in rows_of(tables, TEAM.format(g)):
            if year_of(r) and number(r.get("team_place", "")) == 1:
                winners[year_of(r)].append(r.get("school", ""))
        for r in rows_of(tables, CHAMPIONS.format(g)):
            if year_of(r) and r.get("school", "").strip():
                champions[year_of(r)].append(r.get("school", ""))
        both = sorted(set(winners) & set(champions))
        print(f"   {g} years compared: " + (", ".join(map(str, both)) or "none"))
        for year in both:
            if sorted(winners[year]) != sorted(champions[year]):
                mismatches.append((g, year, winners[year], champions[year]))
    print("   Mismatches:")
    for g, year, won, listed in mismatches:
        print(f"      {g} {year}: team results {' + '.join(map(quote, won))}"
              f" | champions {' + '.join(map(quote, listed))}")
    if not mismatches:
        print("      none")


def time_check(tables):
    print("f. Times that don't look like m:ss or m:ss.s(s)")
    checked, bad = 0, []
    for name, table in tables.items():
        if not table or "time" not in table["header"]:
            continue
        for r in table["rows"]:
            checked += 1
            if not TIME_RE.fullmatch(r["time"]):
                bad.append(f"{RESULTS.get(name, name)} {r.get('year', '')} place {r.get('place', '')} "
                           f"(line {r['_line']}): {quote(r['time'])}")
    for entry in bad:
        print(f"   {entry}")
    if not bad:
        print(f"   none ({checked} times checked)")


def collect(tables, column):
    """{value: {year: {results file, ...}}} for one column of the results files."""
    seen = defaultdict(lambda: defaultdict(set))
    for name in RESULTS:
        for r in rows_of(tables, name):
            if column in r and year_of(r) is not None:
                seen[r[column]][year_of(r)].add(name)
    return seen


def venue_report(tables):
    print("g. Venues: each distinct string as written, with its years and distances")
    venues = collect(tables, "venue")
    for venue in sorted(venues, key=lambda v: (v == "", v)):
        distances = defaultdict(lambda: defaultdict(set))
        for name in RESULTS:
            for r in rows_of(tables, name):
                if r.get("venue") == venue and year_of(r) is not None:
                    distances[r.get("distance", "")][year_of(r)].add(name)
        print(f"   {quote(venue)}")
        say(f"years: {year_list(venues[venue])}", indent="      ")
        say("distances: " + "; ".join(f"{quote(d)} in {year_list(distances[d])}"
                                      for d in sorted(distances, key=lambda d: min(distances[d]))),
            indent="      ")


def distance_report(tables):
    print("h. Distances: each distinct value as written, with its years")
    distances = collect(tables, "distance")
    for distance in sorted(distances, key=lambda d: (d == "", d)):
        say(f"{quote(distance)}: {year_list(distances[distance])}")


def monta_vista_check(tables):
    print('i. Rows where school is "Monta Vista"')
    hits = []
    for table in tables.values():
        if not table:
            continue
        for r in table["rows"]:
            for i, value in enumerate(r["_fields"]):
                if "monta vista" in value.casefold():
                    column = table["header"][i] if i < len(table["header"]) else f"field {i + 1}"
                    hits.append(f"{table['name']} line {r['_line']}, {column}: {quote(value)}")
    for hit in hits:
        print(f"   {hit}")
    if not hits:
        print("   none. Every field of every file was searched, in any letter case.")


def source_url_report(tables):
    print("j. source_url: rows per domain")
    counts = defaultdict(Counter)
    labels = []
    for name in list(RESULTS) + [n for n in tables if n not in RESULTS]:
        table = tables[name]
        if not table or "source_url" not in table["header"]:
            continue
        label = RESULTS.get(name, name)
        labels.append(label)
        for r in table["rows"]:
            url = r["source_url"]
            counts[urlsplit(url).netloc or "(no domain)" if url.strip() else "(blank)"][label] += 1
    width = max([len(host) for host in counts] + [6])
    print("   " + "domain".ljust(width) + "".join(f"  {label:>11}" for label in labels) + "  total")
    for host in sorted(counts, key=lambda h: (-sum(counts[h].values()), h)):
        print("   " + host.ljust(width) + "".join(f"  {counts[host][label]:>11}" for label in labels)
              + f"  {sum(counts[host].values()):>5}")
    say("Domains are counted as written, so www. and bare domains are separate rows. Only "
        "columns named source_url are counted: " + ", ".join(labels) + ".", hang=False)


def main():
    tables = {name: load(name) for name in EXPECTED}
    print("EBAL XC data audit (read-only)")
    print(f"Data folder: {DATA.relative_to(ROOT)}")
    for section in (header_check, coverage_table, top21_check, team_check, champion_check,
                    time_check, venue_report, distance_report, monta_vista_check, source_url_report):
        print()
        section(tables)


if __name__ == "__main__":
    main()
