// Fastest by Venue (venues.html). For each venue, separate girls and boys
// lists of every athlete's best time there, from the top 21 finishers each year.

// Venue sections in page order, by venue_id in venues.csv. Any other venue in
// the data follows, most recent first.
const VENUE_ORDER = ["newhall", "hayward", "shadow-cliffs", "oak-hill"];

// Places shown in each list, by venue_id, the same for girls and boys at a
// venue. Athletes tied on the last place shown are all kept. A venue missing
// here gets the longest length.
const LIST_LENGTHS = {
  "newhall": 25,
  "shadow-cliffs": 25,
  "oak-hill": 15,
  "hayward": 10,
};

// Marks at any other recorded distance get an inline note with the distance as
// written. Years with no recorded distance are listed under the venue heading.
const STANDARD_DISTANCE = /^3 Miles?\b/;

const TOP21_FILE = (gender) => `ebal_xc_${gender.key}_top21.csv`;

start(async () => {
  const data = await loadAll(GENDERS.map(TOP21_FILE));
  const venues = venueList(GENDERS.flatMap((g) => data[TOP21_FILE(g)]));
  // Each venue's section has its venue_id as an id, so venues.html#newhall links to it.
  document.getElementById("venues").append(
    el("nav", { class: "jump", "aria-label": "Venues on this page" },
      el("ul", {}, venues.map((v) => el("li", {}, el("a", { href: `#${v.id}` }, v.name))))),
    ...venues.map((venue) => el("section", { class: "venue", id: venue.id, "aria-labelledby": `venue-${venue.id}` },
      el("h2", { id: `venue-${venue.id}` }, venue.name),
      el("p", {}, "Built from the top 21 finishers each year."),
      el("p", { class: "meta" }, `Years: ${yearSpans(venue.years)}`),
      venue.noDistance.length ? el("p", { class: "meta" }, `Distance not recorded for ${yearSpans(venue.noDistance)}.`) : null,
      el("div", { class: "pair" }, GENDERS.map((g) => fastestList(venue, g, data[TOP21_FILE(g)]))))));
});

// [{ id, name, years, noDistance }] for every venue that venues.csv maps, in
// page order. noDistance holds the years with no recorded distance.
function venueList(rows) {
  const venues = new Map();
  for (const r of rows) {
    const venue = venueOf(r.venue);
    if (!venue) continue;
    if (!venues.has(venue.id)) venues.set(venue.id, { ...venue, years: [], noDistance: [] });
    venues.get(venue.id).years.push(Number(r.year));
    if (r.distance === "") venues.get(venue.id).noDistance.push(Number(r.year));
  }
  const order = (v) => (VENUE_ORDER.includes(v.id) ? VENUE_ORDER.indexOf(v.id) : VENUE_ORDER.length);
  return [...venues.values()].sort((a, b) => order(a) - order(b) || Math.max(...b.years) - Math.max(...a.years));
}

// One athlete is the exact athlete string plus the school's display name.
// Name variants are never merged.
function fastestList(venue, gender, rows) {
  const id = `${venue.id}-${gender.key}`;
  const best = new Map();
  for (const r of rows) {
    if (venueOf(r.venue)?.id !== venue.id) continue;
    const time = seconds(r.time);
    if (Number.isNaN(time)) continue;
    const school = schoolName(r.school);
    const key = JSON.stringify([r.athlete, school]);
    const held = best.get(key);
    if (!held || time < held.time || (time === held.time && Number(r.year) < Number(held.row.year))) {
      best.set(key, { time, row: r, school });
    }
  }
  const list = [...best.values()].sort((a, b) => a.time - b.time || Number(a.row.year) - Number(b.row.year));
  list.forEach((entry, i) => {
    entry.rank = i && entry.time === list[i - 1].time ? list[i - 1].rank : i + 1;
  });
  const length = LIST_LENGTHS[venue.id] ?? Math.max(...Object.values(LIST_LENGTHS));

  const columns = [
    { label: "Rank", class: "num" }, { label: "Athlete" }, { label: "School" },
    { label: "Time", class: "num" }, { label: "Year" },
  ];
  const body = el("tbody", {}, list.filter((entry) => entry.rank <= length).map(({ rank, row, school }) =>
    el("tr", {},
      el("td", { class: "num" }, String(rank)),
      el("th", { scope: "row" }, row.athlete),
      el("td", {}, schoolLabel(school)),
      el("td", { class: "num time" }, row.time, distanceNote(row.distance)),
      el("td", {}, yearLink(row.year)))));
  return el("section", { "aria-labelledby": id },
    el("h3", { id }, `${gender.label}: fastest at this venue`),
    scrollable(id, table(id, columns, [body])));
}

function distanceNote(distance) {
  if (distance === "" || STANDARD_DISTANCE.test(distance)) return null;
  return [" ", el("span", { class: "distance" }, `(${distance})`)];
}

// "15:02.3" -> 902.3. NaN for anything that isn't m:ss with optional decimals.
function seconds(time) {
  if (!/^[0-9]+:[0-9]{2}(\.[0-9]+)?$/.test(time)) return NaN;
  const [minutes, rest] = time.split(":");
  return Number(minutes) * 60 + Number(rest);
}
