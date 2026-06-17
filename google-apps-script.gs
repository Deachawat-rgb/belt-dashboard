/**********************************************************************
 * ITD HONGSA — Belt Conveyor Dashboard : Google Sheets backend API
 * ------------------------------------------------------------------
 * วิธีใช้ (ดูละเอียดใน README.md):
 *   1) สร้าง Google Sheet ใหม่ 1 ไฟล์
 *   2) เมนู Extensions > Apps Script  แล้ววางโค้ดนี้ทั้งหมด (แทนของเดิม)
 *   3) Deploy > New deployment > type: Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      คัดลอก "Web app URL" ไปวางใน index.html ที่ CONFIG.API_URL
 *   4) (ครั้งเดียว) รันฟังก์ชัน setup() จากเมนู Apps Script เพื่อสร้างหัวตาราง
 **********************************************************************/

var SHEET_NAME = 'data';

// ลำดับคอลัมน์ ต้องตรงกับ schema ของ record ใน index.html
var FIELDS = [
  'no','date','year','month','ym','location','system','job','job_raw',
  'len_in','len_out','joint_in','brand','size','reason','puller','splicer',
  'contractor','c_belt','c_equip','c_labor','c_machine','c_contractor',
  'c_total','recorder','engineer'
];

// คอลัมน์ที่เป็นตัวเลข (อ่านกลับเป็น number)
var NUMERIC = {
  year:1, month:1, len_in:1, len_out:1, joint_in:1,
  c_belt:1, c_equip:1, c_labor:1, c_machine:1, c_contractor:1, c_total:1
};

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(FIELDS);
  }
  if (sh.getLastRow() === 0) sh.appendRow(FIELDS);
  return sh;
}

/* รันครั้งเดียวเพื่อสร้างหัวตาราง */
function setup() {
  getSheet_();
}

/* ---------- อ่านข้อมูลทั้งหมด → JSON ---------- */
function doGet(e) {
  try {
    var sh = getSheet_();
    var values = sh.getDataRange().getValues();
    var out = [];
    if (values.length > 1) {
      var head = values[0];
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (row.join('') === '') continue;          // ข้ามแถวว่าง
        var obj = {};
        for (var c = 0; c < head.length; c++) {
          var key = head[c];
          var v = row[c];
          if (v === '' || v === null) {
            obj[key] = NUMERIC[key] ? null : '';
          } else if (NUMERIC[key]) {
            obj[key] = Number(v);
          } else if (key === 'date' && v instanceof Date) {
            obj[key] = Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
          } else {
            obj[key] = String(v);
          }
        }
        out.push(obj);
      }
    }
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- เพิ่ม/seed ข้อมูล ---------- */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var sh = getSheet_();

    if (body.action === 'add' && body.record) {
      sh.appendRow(rowFromRecord_(body.record));
      return json_({ ok: true });
    }

    if (body.action === 'seed' && Array.isArray(body.records)) {
      // เขียนข้อมูลเริ่มต้นทั้งชุด (ล้างของเดิมก่อน)
      sh.clear();
      sh.appendRow(FIELDS);
      var rows = body.records.map(rowFromRecord_);
      if (rows.length) {
        sh.getRange(2, 1, rows.length, FIELDS.length).setValues(rows);
      }
      return json_({ ok: true, inserted: rows.length });
    }

    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function rowFromRecord_(rec) {
  return FIELDS.map(function (f) {
    var v = rec[f];
    return (v === undefined || v === null) ? '' : v;
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
