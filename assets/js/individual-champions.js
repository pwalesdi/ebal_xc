// Individual Champions (champions.html). For each gender, every year from
// FIRST_YEAR, newest first: place 1 in that year's top 21.

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
  const body = [];
  for (let year = lastYear; year >= FIRST_YEAR; year--) {
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
        el("td", {}, schoolName(r.school)),
        el("td", { class: "num time" }, r.time),
        el("td", {}, venueName(r.venue) || "Not recorded")));
    }
  }
  return el("section", { class: "gender", "aria-labelledby": id },
    el("h2", { id }, gender.label),
    scrollable(id, table(id, columns, [el("tbody", {}, body)])));
}
