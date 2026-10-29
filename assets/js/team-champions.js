// Team Champions (team-champions.html). For each gender, every year from
// FIRST_YEAR, newest first: the first-place team where the year has team
// results, the league's champion list otherwise. Then titles by school.

const RESULTS_FILE = (gender) => `ebal_xc_${gender.key}_team_results.csv`;
const LIST_FILE = (gender) => `ebal_xc_${gender.key}_team_champions.csv`;

start(async () => {
  const data = await loadAll(GENDERS.flatMap((g) => [RESULTS_FILE(g), LIST_FILE(g)]));
  const lastYear = Math.max(...Object.values(data).flat().map((r) => Number(r.year)).filter(Number.isFinite));
  const root = document.getElementById("champions");
  for (const gender of GENDERS) {
    const years = champions(data[RESULTS_FILE(gender)], data[LIST_FILE(gender)], lastYear);
    root.append(genderSection(gender, years));
  }
});

// [{ year, schools, hasResults }], newest first. schools holds display names,
// more than one for a shared title, none when no source names a champion.
function champions(results, list, lastYear) {
  const winners = byYear(results.filter((r) => Number(r.team_place) === 1));
  const listed = byYear(list.filter((r) => r.school !== ""));
  const resultYears = byYear(results);
  const years = [];
  for (let year = lastYear; year >= FIRST_YEAR; year--) {
    const rows = winners.get(year) ?? listed.get(year) ?? [];
    years.push({ year, schools: rows.map((r) => schoolName(r.school)), hasResults: resultYears.has(year) });
  }
  return years;
}

function genderSection(gender, years) {
  const id = `${gender.key}-champions`;
  const rows = years.map(({ year, schools, hasResults }) => el("tr", {},
    el("th", { scope: "row" }, hasResults ? yearLink(year) : String(year)),
    schools.length ? el("td", {}, champion(schools)) : notFoundCell(year)));
  return el("section", { class: "gender", "aria-labelledby": id },
    el("h2", { id }, gender.label),
    table(id, [{ label: "Year" }, { label: "Champion" }], [el("tbody", {}, rows)]),
    titles(gender, years));
}

// One school, or each school of a shared title on its own line, then "(shared)".
function champion(schools) {
  if (schools.length === 1) return schoolLabel(schools[0]);
  return [
    el("ul", { class: "shared" }, schools.map((school) => el("li", {}, schoolLabel(school)))),
    el("span", { class: "label" }, "(shared)"),
  ];
}

// Titles by school, counted only from years with a known champion, then the
// years left out of the count. A year with no championship isn't one of them:
// it gets a line of its own.
function titles(gender, years) {
  const id = `${gender.key}-titles`;
  const counts = new Map();
  for (const { schools } of years) {
    for (const school of new Set(schools)) {
      const count = counts.get(school) ?? { titles: 0, shared: 0 };
      count.titles++;
      if (schools.length > 1) count.shared++;
      counts.set(school, count);
    }
  }
  const sorted = [...counts].sort(([a, x], [b, y]) => y.titles - x.titles || a.localeCompare(b));
  const empty = years.filter((y) => !y.schools.length).map((y) => y.year).sort((a, b) => a - b);
  const unknown = empty.filter((year) => !noMeetNotes.has(year));
  const noMeet = empty.filter((year) => noMeetNotes.has(year));
  const rows = sorted.map(([school, count]) => el("tr", {},
    el("th", { scope: "row" }, schoolLabel(school)),
    el("td", { class: "num" }, count.shared ? `${count.titles} (${count.shared} shared)` : String(count.titles))));
  return el("div", { class: "titles" },
    el("h3", { id }, `${gender.label} titles by school`),
    el("p", { class: "note" }, "A shared title counts once for each school that shared it."),
    table(id, [{ label: "School" }, { label: "Titles", class: "num" }], [el("tbody", {}, rows)]),
    el("p", { class: "not-counted" }, unknown.length
      ? `Not counted: no champion has been found yet for ${listText(unknown.map(String))}.`
      : "Every year has a known champion."),
    noMeet.map((year) => el("p", { class: "note" }, noMeetLine(year, noMeetNotes.get(year)))));
}

// 2020 with "No championship (COVID-19)" -> "No championship in 2020 (COVID-19)."
// A note worded any other way -> "2020: <note>."
function noMeetLine(year, note) {
  const text = note.replace(/\.$/, "");
  const match = /^No championship\b(.*)$/.exec(text);
  return match ? `No championship in ${year}${match[1]}.` : `${year}: ${text}.`;
}

// ["A", "B", "C"] -> "A, B and C".
function listText(items) {
  return items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
