/**
 * Watchlist backend — Google Apps Script Web App
 *
 * Setup:
 * 1. Create a Google Sheet. Add a tab named "entries" with header row:
 *    id | title | type | status | rating | date_added
 * 2. Extensions > Apps Script, paste this file in as Code.gs.
 * 3. Set TOKEN below to a random secret string (this guards the endpoint —
 *    anyone with the URL AND this token can read/write your sheet).
 * 4. Deploy > New deployment > type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone with the link
 * 5. Copy the deployment URL and the TOKEN into the app's setup screen.
 */

const TOKEN = "wl_9f2a7c4e1b8d3f60a5c9e2d7b1f48630";
const SHEET_NAME = "entries";
const HEADERS = ["id", "title", "type", "status", "rating", "date_added"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function readAll_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  return rows
    .filter((r) => r[0])
    .map((r) => {
      const obj = {};
      HEADERS.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });
}

function findRowIndexById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1; // 1-indexed, +1 for header
  }
  return -1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function checkToken_(token) {
  return token === TOKEN;
}

function doGet(e) {
  const token = e.parameter.token;
  if (!checkToken_(token)) return json_({ error: "Unauthorized" });

  const action = e.parameter.action;
  if (action === "list") {
    return json_({ entries: readAll_() });
  }
  return json_({ error: "Unknown action" });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: "Bad request" });
  }

  if (!checkToken_(body.token)) return json_({ error: "Unauthorized" });

  const sheet = getSheet_();
  const entry = body.entry || {};

  if (body.action === "add") {
    sheet.appendRow(HEADERS.map((h) => entry[h] ?? ""));
    return json_({ ok: true });
  }

  if (body.action === "update") {
    const rowIndex = findRowIndexById_(sheet, entry.id);
    if (rowIndex === -1) return json_({ error: "Not found" });
    sheet
      .getRange(rowIndex, 1, 1, HEADERS.length)
      .setValues([HEADERS.map((h) => entry[h] ?? "")]);
    return json_({ ok: true });
  }

  if (body.action === "delete") {
    const rowIndex = findRowIndexById_(sheet, entry.id);
    if (rowIndex === -1) return json_({ error: "Not found" });
    sheet.deleteRow(rowIndex);
    return json_({ ok: true });
  }

  return json_({ error: "Unknown action" });
}
