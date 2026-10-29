# EBAL cross country championship history

A static site of EBAL cross country championship history for girls and boys, covering team results, top-21 individuals and team champions by year. It is plain HTML, CSS and JS, served as is.

## Rules

- Once published, every push deploys publicly in about a minute. There is no staging.
- Never `git add` a directory. Stage files by name.
- Data lives in CSVs under assets/data/ and is rendered by small plain-JS files. No frameworks, build step or carousel libraries. One stylesheet, one CSV parser.
- Use relative asset paths (assets/...), never root-absolute (/assets/...). Keep every page at the repo root. The site may be served from a subpath, so root-absolute paths would point at a different site.
- Header and footer are duplicated on every page and must stay identical. tools/check_chrome.py verifies this (write it when the first two pages exist).
- Athlete and school names appear exactly as they are in the CSVs. Never normalize, correct or merge a spelling. Never comment on a name variation in a file, a commit message or a README.
- "Monta Vista" (Cupertino) and "Monte Vista" (Danville) are different schools.
- Boys and girls never share a table, list or combined score.
- Every meet reference carries day and date, e.g. "Saturday, November 8, 2025".
- Fast marks are "fastest on this course" or "fastest in meet history", never "record". Cross country courses aren't record-eligible.
- This is a league site covering every EBAL school. Neutral design: no Monte Vista colours, logos or wordmarks, and no school favoured visually.
- Highlighting never relies on colour alone. Always add a text or label cue as well.
- Phone first. Check at 390px and 1280px wide before committing.
- No current-athlete roster anywhere. Historical results only.
- Every photo needs a recorded photographer credit before it's published. Strip image metadata losslessly (jpegtran -copy none), never by re-encoding.

## Layout

- `index.html`: placeholder for now. Every page sits at the repo root.
- `assets/css/site.css`: the one stylesheet.
- `assets/js/csv.js`: the one CSV parser. `parseCSV(text)` returns one object per row, keyed by the header row, with values exactly as written.
- `assets/data/`: the CSVs.
  - `ebal_xc_girls_team_results.csv`, `ebal_xc_boys_team_results.csv`: team standings at each year's championship meet.
  - `ebal_xc_girls_top21.csv`, `ebal_xc_boys_top21.csv`: the top 21 individuals at each meet.
  - `ebal_xc_girls_team_champions.csv`, `ebal_xc_boys_team_champions.csv`: the league-site champion list, 1977–2013, plus a few filled years.
  - `ebal_xc_coverage_log.csv`: what was found for each year and gender, and the sources used and tried.
- `tools/`: check scripts. `python3 tools/audit_data.py` prints a read-only audit of the CSVs.

Preview with `python3 -m http.server` from the repo root. Pages fetch their CSVs, and fetch doesn't work from file://.
