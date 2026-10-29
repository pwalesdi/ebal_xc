// Shared by every page: loading the CSVs and the two lookup tables, building
// elements, and marking the current page in the header. Load after csv.js.

const DATA_DIR = "assets/data/";

// The first season in the league's champion list.
const FIRST_YEAR = 1977;

// School logos. Every logo is drawn in the same square, so no school's logo is
// bigger than another's.
const LOGO_DIR = "assets/img/schools/";
const LOGO_SIZE = 20;

const GENDERS = [
  { key: "girls", label: "Girls" },
  { key: "boys", label: "Boys" },
];

// Fetches one CSV from assets/data/ and parses it.
async function loadCSV(name) {
  const response = await fetch(DATA_DIR + name);
  if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
  return parseCSV(await response.text());
}

// Loads several CSVs at once. Returns {file name: rows}.
async function loadAll(names) {
  const tables = await Promise.all(names.map(loadCSV));
  return Object.fromEntries(names.map((name, i) => [name, tables[i]]));
}

let schoolNames = new Map();
let logoFiles = new Map();
let venuesBySource = new Map();

async function loadLookups() {
  const { "schools.csv": schools, "school_logos.csv": logos, "venues.csv": venues } =
    await loadAll(["schools.csv", "school_logos.csv", "venues.csv"]);
  schoolNames = new Map(schools.map((r) => [r.source_name, r.display_name]));
  logoFiles = new Map(logos.filter((r) => r.logo_file !== "").map((r) => [r.display_name, r.logo_file]));
  venuesBySource = new Map(venues.map((r) => [r.source_venue, { id: r.venue_id, name: r.venue_name }]));
}

// The name a page shows for a school string from the data. A string missing
// from schools.csv is shown as written.
function schoolName(source) {
  return schoolNames.get(source) ?? source;
}

// A school's display name with its logo immediately before it. The logo's alt
// is empty because the name is right beside it. A school with no logo gets an
// empty space of the same size, so names still line up.
function schoolLabel(name) {
  const file = logoFiles.get(name);
  const logo = file
    ? el("img", { class: "logo", src: LOGO_DIR + file, alt: "", width: LOGO_SIZE, height: LOGO_SIZE })
    : el("span", { class: "logo" });
  return el("span", { class: "school" }, logo, el("span", {}, name));
}

// {id, name} for a venue string from the data, or null if venues.csv doesn't map it.
function venueOf(source) {
  return venuesBySource.get(source) ?? null;
}

// The name a page shows for a venue string: its venue_name, the string as
// written if venues.csv doesn't map it, or "" if it's empty.
function venueName(source) {
  return venueOf(source)?.name ?? source;
}

// el("td", { class: "num" }, "21") builds an element. Attributes that are null,
// undefined or false are left out. Children are nodes or strings, and strings
// are added as text, never parsed as HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== false) node.setAttribute(name, value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// A table labelled by the heading with id labelId. columns: [{ label, class }].
// bodies: tbody elements. attrs: any other attributes for the table.
function table(labelId, columns, bodies, attrs = {}) {
  const head = el("thead", {}, el("tr", {}, columns.map((c) => el("th", { scope: "col", class: c.class }, c.label))));
  return el("table", { "aria-labelledby": labelId, ...attrs }, head, bodies);
}

// Puts a wide table in its own horizontal scroll container, so on a phone the
// table scrolls sideways and the page doesn't. The container takes focus so
// it can be scrolled from the keyboard.
function scrollable(labelId, tableNode) {
  return el("div", { class: "table-wrap", role: "region", "aria-labelledby": labelId, tabindex: "0" }, tableNode);
}

// A link to Results by Year for one year.
function yearLink(year) {
  return el("a", { href: `results.html?year=${year}` }, String(year));
}

// Rows grouped by year: Map(year number -> rows).
function byYear(rows) {
  const years = new Map();
  for (const row of rows) {
    const year = Number(row.year);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(row);
  }
  return years;
}

// [2013, 2014, 2015, 2019] -> "2013–2015, 2019".
function yearSpans(years) {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    spans.push(i === j ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return spans.join(", ");
}

// The header is identical on every page, so the current page's link is marked here.
function markCurrentPage() {
  const page = (path) => path.replace(/\/$/, "/index").replace(/\.html$/, "");
  const here = page(location.pathname);
  for (const link of document.querySelectorAll(".site-nav a")) {
    if (page(new URL(link.href).pathname) === here) link.setAttribute("aria-current", "page");
  }
}

// Loads the lookup tables, then runs the page's render function. Shows a
// loading message meanwhile, then removes it, or replaces it with what went wrong.
async function start(render) {
  markCurrentPage();
  const status = document.querySelector("[data-status]");
  status.textContent = "Loading results…";
  try {
    await loadLookups();
    await render();
    status.remove();
  } catch (error) {
    console.error(error);
    status.textContent = location.protocol === "file:"
      ? "The results can't load from a file. Serve the folder over HTTP, for example with python3 -m http.server."
      : "The results couldn't be loaded. Please try again later.";
    status.classList.add("error");
  }
}
