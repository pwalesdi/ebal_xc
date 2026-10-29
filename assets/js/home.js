// Home (index.html). The coming championship meet, from upcoming_meet.csv and
// upcoming_schedule.csv so it can be updated each year without touching the
// page. Then the defending champions and the years the championship was held on
// the same course, from the results data.

// Races whose name starts with "Varsity" get a Varsity label in the schedule.
// "Junior Varsity" races don't.
const VARSITY = /^Varsity\b/;

// Added to the location for the map search. Every EBAL venue is in California.
const MAP_REGION = "CA";

const MEET_FILE = "upcoming_meet.csv";
const SCHEDULE_FILE = "upcoming_schedule.csv";
const TEAM_FILE = (gender) => `ebal_xc_${gender.key}_team_results.csv`;
const LIST_FILE = (gender) => `ebal_xc_${gender.key}_team_champions.csv`;
const TOP21_FILE = (gender) => `ebal_xc_${gender.key}_top21.csv`;

start(async () => {
  const data = await loadAll([MEET_FILE, SCHEDULE_FILE,
    ...GENDERS.flatMap((g) => [TEAM_FILE(g), LIST_FILE(g), TOP21_FILE(g)])]);
  // upcoming_meet.csv holds one value per field.
  const meet = Object.fromEntries(data[MEET_FILE].map((r) => [r.field, r.value]));
  const results = GENDERS.flatMap((g) => [...data[TEAM_FILE(g)], ...data[TOP21_FILE(g)]]);
  if (meet.title) {
    document.querySelector("[data-meet-title]").textContent = meet.title;
    document.title = `${meet.title} · ${document.title}`;
  }
  const sections = [
    meetFacts(meet),
    schedule(data[SCHEDULE_FILE], meet.note),
    defending(data, results),
    onThisCourse(meet.venue_id, meet.location, results),
    mapLink(meet.location),
  ];
  document.getElementById("home").append(...sections.filter(Boolean));
});

// The meet's details, each with a label. A field left blank is left out.
function meetFacts(meet) {
  const facts = [
    ["Date", meet.date],
    ["First race", meet.first_race],
    ["Location", meet.location],
    ["Host", meet.host && schoolLabel(schoolName(meet.host))],
    ["Meet director", meet.meet_director],
  ];
  return el("dl", { class: "facts" }, facts.filter(([, value]) => value)
    .flatMap(([term, value]) => [el("dt", {}, term), el("dd", {}, value)]));
}

// The races in the order listed, each with its start time, then the note.
function schedule(rows, note) {
  const id = "schedule";
  const body = el("tbody", {}, rows.map((r) => {
    const varsity = VARSITY.test(r.race);
    return el("tr", { class: varsity ? "varsity" : null },
      el("th", { scope: "row", class: "num" }, r.time),
      el("td", {}, r.race, varsity ? [" ", el("span", { class: "tag" }, "Varsity")] : null));
  }));
  return el("section", { "aria-labelledby": id },
    el("h2", { id }, "Race schedule"),
    rows.length
      ? table(id, [{ label: "Time", class: "num" }, { label: "Race" }], [body], { class: "schedule" })
      : el("p", { class: "missing" }, "Schedule not yet posted."),
    note ? el("p", {}, note) : null);
}

// The champions at the latest meet with results, girls and boys separately.
function defending(data, results) {
  const year = Math.max(...results.map((r) => Number(r.year)).filter(Number.isFinite));
  if (!Number.isFinite(year)) return null;
  const rows = results.filter((r) => Number(r.year) === year);
  const venue = distinctValues(rows, "venue", venueName);
  const id = "defending";
  return el("section", { "aria-labelledby": id },
    el("h2", { id }, "Defending champions"),
    el("p", { class: "meta" },
      `${year} championship meet`, separator(),
      distinctValues(rows, "meet_date") || "Date not recorded",
      venue ? [separator(), venue] : null,
      separator(), el("a", { href: `results.html?year=${year}` }, `${year} results`)),
    el("div", { class: "pair" }, GENDERS.map((g) => defendingFor(g, year, data))));
}

// The team champion is the first-place team in the team results, or the
// league's champion list for a year without them, as on Team Champions. The
// individual champion is place 1 in the top 21.
function defendingFor(gender, year, data) {
  const id = `defending-${gender.key}`;
  const ofYear = (rows) => rows.filter((r) => Number(r.year) === year);
  const winners = ofYear(data[TEAM_FILE(gender)]).filter((r) => Number(r.team_place) === 1);
  const listed = ofYear(data[LIST_FILE(gender)]).filter((r) => r.school !== "");
  const teams = (winners.length ? winners : listed).map((r) => schoolName(r.school));
  const individuals = ofYear(data[TOP21_FILE(gender)]).filter((r) => Number(r.place) === 1);
  const notFound = () => el("dd", { class: "missing" }, "Not yet found");
  return el("section", { "aria-labelledby": id },
    el("h3", { id }, gender.label),
    el("dl", { class: "facts" },
      el("dt", {}, "Team champion"),
      teams.length ? teams.map((school) => el("dd", {}, schoolLabel(school))) : notFound(),
      teams.length > 1 ? el("dd", {}, el("span", { class: "label" }, "(shared)")) : null,
      el("dt", {}, "Individual champion"),
      individuals.length
        ? individuals.map((r) => el("dd", {}, r.athlete, schoolLabel(schoolName(r.school))))
        : notFound(),
      individuals.length ? el("dt", {}, "Winning time") : null,
      individuals.map((r) => el("dd", { class: "time" }, r.time || "Not recorded"))));
}

// Every year the championship was held at the coming meet's venue, matched by
// venue_id through venues.csv, then a link to the venue's lists on Fastest by Venue.
function onThisCourse(venueId, location, results) {
  if (!venueId) return null;
  const years = [...new Set(results.filter((r) => venueOf(r.venue)?.id === venueId).map((r) => Number(r.year)))]
    .sort((a, b) => a - b);
  const name = [...venuesBySource.values()].find((v) => v.id === venueId)?.name ?? location;
  const id = "course";
  return el("section", { "aria-labelledby": id },
    el("h2", { id }, "On this course"),
    years.length ? [
      el("p", {}, `Championships held at ${name}:`),
      el("ul", { class: "years" }, years.map((year) => el("li", {}, yearLink(year)))),
      el("p", {}, el("a", { href: `venues.html#${venueId}` }, "Fastest at this venue, girls and boys")),
    ] : el("p", { class: "missing" }, `No championship results at ${name} yet.`));
}

// A Google Maps search for the location with MAP_REGION added, commas dropped:
// "Newhall Park, Concord" searches for "Newhall Park Concord CA".
function mapLink(location) {
  if (!location) return null;
  const query = [...location.split(/[\s,]+/).filter(Boolean), MAP_REGION].join(" ");
  const href = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
  const id = "map";
  return el("section", { "aria-labelledby": id },
    el("h2", { id }, "Map"),
    el("p", {}, el("a", { href }, `${location} on Google Maps`)));
}
