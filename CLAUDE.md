# EBAL cross country championship history

A static site of EBAL cross country championship history for girls and boys, covering team results, top-21 individuals and team champions by year. It is plain HTML, CSS and JS, served as is.

## Rules

- Once published, every push deploys publicly in about a minute. There is no staging.
- Never `git add` a directory. Stage files by name.
- Data lives in CSVs under assets/data/ and is rendered by small plain-JS files. No frameworks, build step or carousel libraries. One stylesheet, one CSV parser.
- Use relative asset paths (assets/...), never root-absolute (/assets/...). Keep every page at the repo root. The site may be served from a subpath, so root-absolute paths would point at a different site.
- Header and footer are duplicated on every page and must stay identical. `python3 tools/check_chrome.py` verifies this.
- Athlete names appear exactly as they are in the CSVs. School names are displayed through assets/data/schools.csv; never change a school name anywhere else. Never normalize, correct or merge a spelling. Never comment on a name variation in a file, a commit message or a README.
- "Monta Vista" (Cupertino) and "Monte Vista" (Danville) are different schools.
- Boys and girls never share a table, list or combined score.
- Every meet reference carries day and date, e.g. "Saturday, November 8, 2025".
- Fast marks are "fastest at this venue", "fastest on this course" or "fastest in meet history", never "record". Cross country courses aren't record-eligible.
- This is a league site covering every EBAL school. Neutral site design: no school's colours anywhere in the site chrome. School logos appear beside school names, every school at the same size, none favoured.
- Highlighting never relies on colour alone. Always add a text or label cue as well.
- Phone first. Check at 390px and 1280px wide before committing.
- No current-athlete roster anywhere. Historical results only.
- Every photo needs a recorded photographer credit before it's published. Strip image metadata losslessly (jpegtran -copy none), never by re-encoding.

## Layout

Every page sits at the repo root and shares the same header and footer.

- `index.html`: Home. The coming championship meet from upcoming_meet.csv and upcoming_schedule.csv: details, race schedule and note. Then the defending champions from the latest year with results, the years the championship was held on the meet's course, and a map link.
- `team-champions.html`: Team Champions. Girls and boys champions for every year from 1977, with titles by school.
- `results.html`: Results by Year. `results.html?year=2025` links to one year. A year with videos in videos.csv lists them after its results.
- `champions.html`: Individual Champions, from place 1 in each year's top 21, back to the first year with results (2008). One line under each table covers the years before.
- `venues.html`: Fastest by Venue. Each athlete's best time at each venue, with a list length set per venue. Each venue's section has its venue_id as an anchor (`venues.html#newhall`).
- `videos.html`: Race Videos. Every video in videos.csv, grouped by year, newest first. Plain links to YouTube: no embedded players, nothing loaded from YouTube. The contact line shows "[contact TBD]" until contact details are supplied.
- `assets/css/site.css`: the one stylesheet.
- `assets/img/schools/`: one logo per school, named by display name (`amador-valley.jpg`, `california.png`, ...). Pages show each at 20px in the same square, with `alt=""`, immediately before the school name. Metadata is stripped losslessly: JPEG with `jpegtran -copy none -optimize`; PNG by dropping the ancillary chunks (keeping `tRNS` if present), then checking the decoded pixels match the source.
- `assets/js/csv.js`: the one CSV parser. `parseCSV(text)` returns one object per row, keyed by the header row, with values exactly as written.
- `assets/js/common.js`: shared by every page. Loads CSVs and the lookup tables (schools, school logos, venues), builds elements, including each school's logo and name and the list of videos, and marks the current page in the header.
- `assets/js/home.js`, `team-champions.js`, `results.js`, `individual-champions.js`, `venues.js`, `videos.js`: one render file per page. Settings that may change (the Varsity label rule, All-EBAL place ranges, venue order, list lengths per venue) sit at the top of each.
- `assets/data/`: the CSVs.
  - `ebal_xc_girls_team_results.csv`, `ebal_xc_boys_team_results.csv`: team standings at each year's championship meet.
  - `ebal_xc_girls_top21.csv`, `ebal_xc_boys_top21.csv`: the top 21 individuals at each meet.
  - `ebal_xc_girls_team_champions.csv`, `ebal_xc_boys_team_champions.csv`: the league-site champion list, 1977–2013, plus a few filled years.
  - `schools.csv`: `source_name,display_name`. Every school string in the data, with the short league name the pages show. A new school string needs a row here.
  - `school_logos.csv`: `display_name,athletic_net_id,logo_file`. One row per display name in schools.csv. Logos are matched by athletic.net ID, never by name. A blank `logo_file` means no logo, and the pages leave an empty space of the same size.
  - `venues.csv`: `source_venue,venue_id,venue_name`. Every venue string, with the venue it belongs to. A new venue string needs a row here.
  - `upcoming_meet.csv`: `field,value`. The coming meet's title, date, location, venue_id (as in venues.csv), host (a school, shown through schools.csv with its logo), meet director, first race and note. Updated each year.
  - `upcoming_schedule.csv`: `race,time`. The coming meet's races, in order. A race whose name starts with "Varsity" gets a Varsity label.
  - `videos.csv`: `year,creator,creator_role,url`. Race videos, shown as written, each a YouTube link.
- The coverage log (what was found for each year and gender, and the sources used and tried) is kept outside the repo.
- `tools/`: check scripts.
  - `python3 tools/audit_data.py [path/to/ebal_xc_coverage_log.csv]` prints a read-only audit of the CSVs. Without the log's path, the parts that use the log are skipped.
  - `python3 tools/check_chrome.py` checks that every page's header and footer are identical.

Preview with `python3 -m http.server` from the repo root. Pages fetch their CSVs, and fetch doesn't work from file://.
