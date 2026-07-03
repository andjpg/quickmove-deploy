/**
 * QuickMove Intake Tracker — Google Apps Script backend.
 *
 * SETUP:
 * 1. Open (or create) the Google Sheet you want to use as your tracker.
 * 2. Extensions > Apps Script.
 * 3. Delete the placeholder code in Code.gs and paste this entire file in its place.
 * 4. Save (Ctrl+S / Cmd+S).
 * 5. Deploy > New deployment > gear icon > select type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy, authorize the permissions when prompted (it's your own script,
 *    Google will warn it's unverified — click Advanced > Go to project (unsafe)).
 * 7. Copy the Web App URL you're given — you'll paste this into the tracker app's
 *    Settings panel.
 *
 * This script auto-creates a sheet tab called "Intake" with headers on first use —
 * you don't need to set up columns yourself.
 */

function doGet(e) {
  var sheet = getIntakeSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    records.push(row);
  }
  return jsonOutput_({ ok: true, records: records });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getIntakeSheet_();

    if (body.action === 'add') {
      sheet.appendRow([
        body.id,
        body.ts,
        body.customer || 'Unknown',
        body.pillar || 'General',
        body.urgency || 'Low',
        body.summary || '',
        body.suggested_action || '',
        body.raw || '',
        body.status || 'Open'
      ]);
      return jsonOutput_({ ok: true });
    }

    if (body.action === 'updateStatus') {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.id)) {
          sheet.getRange(i + 1, 9).setValue(body.status); // column 9 = status
          break;
        }
      }
      return jsonOutput_({ ok: true });
    }

    return jsonOutput_({ ok: false, error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

function getIntakeSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Intake');
  if (!sheet) {
    sheet = ss.insertSheet('Intake');
    sheet.appendRow(['id', 'ts', 'customer', 'pillar', 'urgency', 'summary', 'suggested_action', 'raw', 'status']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
