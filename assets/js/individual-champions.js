// Individual Champions (champions.html). For each gender, place 1 in each
// year's top 21, newest first, back to the first year with results. One line
// under the table covers the years before that.

const TOP21_FILE = (gender) => `ebal_xc_${gender.key}_top21.csv`;

start(async () => {
  const data = await loadAll(GENDERS.map(TOP21_FILE));
  const lastYear = Math.max(...Object.values(data).flat().map((r) => Number(r.year)).filter(Number.isFinite));
  const root = document.getElementById("champions");
  for (const gender of GENDERS) root.append(genderSection(gender, data[TOP21_FILE(gender)], lastYear));
});

function genderSection(gender, rows, lastYear) {
  const id = `${gender.key}-champions`;
  const columns = [
    { label: "Year" }, { label: "Athlete" }, { label: "School" },
    { label: "Time", class: "num" }, { label: "Venue" },
  ];
  const winners = byYear(rows.filter((r) => Number(r.place) === 1));
  const firstYear = winners.size ? Math.min(...winners.keys()) : lastYear + 1;
  const body = [];
  for (let year = lastYear; year >= firstYear; year--) {
    const found = winners.get(year);
    if (!found) {
      body.push(el("tr", {},
        el("th", { scope: "row" }, String(year)),
        el("td", { class: "missing", colspan: columns.length - 1 }, "Not yet found")));
      continue;
    }
    for (const r of found) {
      body.push(el("tr", {},
        el("th", { scope: "row" }, yearLink(year)),
        el("td", {}, r.athlete),
        el("td", {}, schoolLabel(schoolName(r.school))),
        el("td", { class: "num time" }, r.time),
        el("td", {}, venueName(r.venue) || "Not recorded")));
    }
  }
  return el("section", { class: "gender", "aria-labelledby": id },
    el("h2", { id }, gender.label),
    scrollable(id, table(id, columns, [el("tbody", {}, body)])),
    firstYear > FIRST_YEAR ? el("p", { class: "note" }, `Individual champions before ${firstYear} not yet found.`) : null);
}
