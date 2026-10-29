// Race Videos (videos.html). Every video in videos.csv, grouped by year, newest
// first. Each year shows its meet's date and venue from the results, and links
// to that year's results.

const TEAM_FILE = (gender) => `ebal_xc_${gender.key}_team_results.csv`;
const TOP21_FILE = (gender) => `ebal_xc_${gender.key}_top21.csv`;

start(async () => {
  const files = GENDERS.flatMap((g) => [TEAM_FILE(g), TOP21_FILE(g)]);
  const data = await loadAll([VIDEOS_FILE, ...files]);
  const results = byYear(files.flatMap((file) => data[file]));
  const videos = byYear(data[VIDEOS_FILE]);
  const years = [...videos.keys()].filter(Number.isFinite).sort((a, b) => b - a);
  document.getElementById("videos").append(...(years.length
    ? years.map((year) => yearSection(year, videos.get(year), results.get(year) ?? []))
    : [el("p", { class: "missing" }, "No videos yet.")]));
});

function yearSection(year, videos, rows) {
  const id = `videos-${year}`;
  const venue = distinctValues(rows, "venue", venueName);
  return el("section", { class: "video-year", "aria-labelledby": id },
    el("h2", { id }, String(year)),
    el("p", { class: "meta" },
      distinctValues(rows, "meet_date") || "Date not recorded",
      venue ? [separator(), venue] : null,
      rows.length ? [separator(), el("a", { href: `results.html?year=${year}` }, `${year} results`)] : null),
    videoList(videos));
}
