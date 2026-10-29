// Results by Year (results.html). One year's championship meet, picked with
// ?year= so each year can be linked. Defaults to the latest year.

// All-EBAL teams by place in the top 21. Each label covers places from–to.
const ALL_EBAL = {
  "First Team All-EBAL": { from: 1, to: 10 },
  "Second Team All-EBAL": { from: 11, to: 21 },
};

// Links to these sources say what they are instead of "Official results".
const SOURCE_LABELS = {
  "https://www.crosscountryexpress.com/2012/11/early-report-from-ebal.html": "Unofficial blog report",
};

// The four sections, in page order. Girls and boys never share a table.
const SECTIONS = GENDERS.flatMap((gender) => [
  { gender, id: `${gender.key}-team`, file: `ebal_xc_${gender.key}_team_results.csv`,
    title: `${gender.label} team scores`, render: teamTable, missing: "Team scores not yet found." },
  { gender, id: `${gender.key}-top21`, file: `ebal_xc_${gender.key}_top21.csv`,
    title: `${gender.label} top 21`, render: top21Table, missing: "Individual results not yet found." },
]);

start(async () => {
  const data = await loadAll(SECTIONS.map((s) => s.file));
  const years = [...new Set(SECTIONS.flatMap((s) => data[s.file].map((r) => Number(r.year))))]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const asked = new URLSearchParams(location.search).get("year");
  const year = years.includes(Number(asked)) ? Number(asked) : years[0];

  const select = document.getElementById("year");
  select.replaceChildren(...years.map((y) => el("option", { value: y, selected: y === year ? "" : null }, String(y))));
  select.form.hidden = false;
  document.title = `${year} · ${document.title}`;

  const root = document.getElementById("results");
  if (asked !== null && Number(asked) !== year) {
    root.append(el("p", { class: "notice" }, /^[0-9]{4}$/.test(asked)
      ? `No results have been found for ${asked} yet. Showing ${year}.`
      : `Showing the latest year, ${year}.`));
  }
  const sections = SECTIONS.map((s) => ({ ...s, rows: data[s.file].filter((r) => Number(r.year) === year) }));
  root.append(meet(year, sections));
});

function meet(year, sections) {
  const rows = sections.flatMap((s) => s.rows);
  // Each distinct value as written, joined if girls and boys ever differ.
  const values = (column, show = (v) => v) =>
    [...new Set(rows.map((r) => r[column]).filter((v) => v !== "").map(show))].join(" / ");
  const facts = [
    values("meet_date") || "Date not recorded",
    values("venue", venueName) || "Venue not recorded",
    values("distance") || "Distance not recorded",
  ];
  return el("article", { class: "meet", "aria-labelledby": "meet-heading" },
    el("h2", { id: "meet-heading" }, `${year} championship meet`),
    el("p", { class: "meet-line" }, facts.flatMap((fact, i) => [i ? separator() : null, el("span", {}, fact)])),
    sources(sections),
    sections.map((s) => el("section", { "aria-labelledby": s.id },
      el("h3", { id: s.id }, s.title),
      s.rows.length ? s.render(s.id, s.rows) : el("p", { class: "missing" }, s.missing))));
}

// One link per distinct source_url. Each link names its gender when the year
// has more than one.
function sources(sections) {
  const urls = new Map();
  for (const s of sections) {
    for (const r of s.rows) {
      if (r.source_url === "") continue;
      if (!urls.has(r.source_url)) urls.set(r.source_url, new Set());
      urls.get(r.source_url).add(s.gender.label.toLowerCase());
    }
  }
  if (!urls.size) return null;
  const links = [...urls].map(([url, genders]) => {
    const label = SOURCE_LABELS[url] ?? "Official results";
    return el("a", { href: url }, urls.size > 1 ? `${label}: ${[...genders].join(" and ")}` : label);
  });
  return el("p", { class: "sources" }, links.flatMap((link, i) => [i ? separator() : null, link]));
}

function separator() {
  return el("span", { class: "sep", "aria-hidden": "true" }, " · ");
}

function teamTable(id, rows) {
  const sorted = [...rows].sort((a, b) => Number(a.team_place) - Number(b.team_place));
  const body = el("tbody", {}, sorted.map((r) => el("tr", {},
    el("td", { class: "num" }, r.team_place),
    el("th", { scope: "row" }, schoolName(r.school)),
    el("td", { class: "num" }, r.team_score === "" ? "Not recorded" : r.team_score))));
  const tied = rows.some((r) => r.team_score.endsWith("*"));
  return [
    table(id, [{ label: "Place", class: "num" }, { label: "School" }, { label: "Score", class: "num" }], [body],
      { class: "team-scores" }),
    tied ? el("p", { class: "footnote" }, "* Tie, as marked in the official results.") : null,
  ];
}

// Places grouped under their All-EBAL label. Places outside every range in
// ALL_EBAL follow in a group with no label.
function top21Table(id, rows) {
  const sorted = [...rows].sort((a, b) => Number(a.place) - Number(b.place));
  const groups = Object.entries(ALL_EBAL).map(([label, { from, to }]) =>
    ({ label, rows: sorted.filter((r) => Number(r.place) >= from && Number(r.place) <= to) }));
  const grouped = new Set(groups.flatMap((g) => g.rows));
  groups.push({ label: null, rows: sorted.filter((r) => !grouped.has(r)) });

  const columns = [
    { label: "Place", class: "num" }, { label: "Athlete" }, { label: "Grade" },
    { label: "School" }, { label: "Time", class: "num" },
  ];
  const bodies = groups.filter((g) => g.rows.length).map((g) => el("tbody", {},
    g.label ? el("tr", { class: "group" }, el("th", { scope: "rowgroup", colspan: columns.length }, g.label)) : null,
    g.rows.map((r) => el("tr", {},
      el("td", { class: "num" }, r.place),
      el("th", { scope: "row" }, r.athlete),
      el("td", {}, r.grade),
      el("td", {}, schoolName(r.school)),
      el("td", { class: "num time" }, r.time)))));
  return scrollable(id, table(id, columns, bodies));
}
