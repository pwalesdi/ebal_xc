// Stories (stories.html). Notable moments from the cross country history of
// EBAL schools, newest first, from stories.csv. Each is a short original summary
// that links to its source. Stories are only shown here: they never feed the
// champions tables, title counts or results.

const STORIES_FILE = "stories.csv";

start(async () => {
  const { [STORIES_FILE]: rows } = await loadAll([STORIES_FILE]);
  const stories = [...rows].sort((a, b) => Number(b.year) - Number(a.year));
  document.getElementById("stories").append(...(stories.length
    ? stories.map((s, i) => story(s, `story-${i + 1}`))
    : [el("p", { class: "missing" }, "No stories yet.")]));
});

// Year and school, then the title, the summary, the context line if there is
// one, and the link to the full story. Text only: nothing from the source site.
function story(s, id) {
  return el("article", { class: "story", "aria-labelledby": id },
    el("p", { class: "story-meta" }, el("span", {}, s.year), schoolLabel(schoolName(s.school))),
    el("h2", { id }, s.title),
    el("p", {}, s.summary),
    s.context ? el("p", { class: "context" }, s.context) : null,
    s.source_url
      ? el("p", {}, el("a", { href: s.source_url }, `Read the full story at ${s.source_name || "the source"}`))
      : null);
}
