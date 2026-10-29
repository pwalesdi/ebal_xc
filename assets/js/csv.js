// The site's one CSV parser. Handles quoted fields (commas, line breaks and
// doubled "" quotes inside quotes), CRLF or LF line endings and a leading byte
// order mark. Values come back exactly as written: nothing is trimmed or
// converted. A quote that doesn't open a field is kept as an ordinary character.

// Returns an array of rows, each an array of field strings. Blank lines are skipped.
function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;   // the current field opened with a quote
  let inQuotes = false; // still inside that quoted section

  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = false;
    } else if (c === '"' && field === "") {
      quoted = inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      quoted = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length || field !== "" || quoted) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      quoted = false;
    } else {
      field += c;
    }
  }
  if (row.length || field !== "" || quoted) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Returns one object per data row, keyed by the header row. A row with fewer
// fields than the header gets "" for the missing ones; extra fields are dropped.
function parseCSV(text) {
  const [header = [], ...rows] = parseCSVRows(text);
  return rows.map((row) => {
    const record = {};
    header.forEach((name, j) => { record[name] = j < row.length ? row[j] : ""; });
    return record;
  });
}
