/**********************************************************************
 * ITD HONGSA — Belt Conveyor Dashboard : Google Sheets backend API
 * (มีระบบ Login + Token ป้องกันข้อมูล)
 * ------------------------------------------------------------------
 * วิธีติดตั้ง (ดูละเอียดใน README.md):
 *   1) Extensions > Apps Script  แล้ววางโค้ดนี้ทั้งหมด (แทนของเดิม)
 *   2) ตั้งรหัสผ่าน: แก้ค่า PASSWORD ในฟังก์ชัน setCredentials() ด้านล่าง
 *      แล้วเลือกฟังก์ชัน setCredentials > กด Run 1 ครั้ง (Allow สิทธิ์)
 *   3) Deploy > Manage deployments > (ดินสอ) Edit > Version: New version
 *      - Execute as: Me   /   Who has access: Anyone   > Deploy
 *      URL เดิมใช้ได้ต่อ ไม่ต้องเปลี่ยนใน index.html
 *
 * ความปลอดภัย: รหัสผ่าน (เก็บเป็น hash) และ SECRET อยู่ใน Script Properties
 * ฝั่งเซิร์ฟเวอร์เท่านั้น — ไม่อยู่ในโค้ดที่ push ขึ้น GitHub
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

var TOKEN_TTL_MS = 1000 * 60 * 60 * 12;   // อายุ token 12 ชั่วโมง
var PROPS = PropertiesService.getScriptProperties();

/* ============================================================
 *  ตั้งรหัสผ่าน — แก้ค่า PASSWORD ด้านล่าง แล้ว Run ฟังก์ชันนี้ 1 ครั้ง
 *  (รหัสจริงจะถูกเก็บเป็น hash ใน Script Properties ไม่อยู่ในโค้ด)
 * ============================================================ */
function setCredentials() {
  var PASSWORD = 'CHANGE_ME';   // <<<<<< เปลี่ยนเป็นรหัสผ่านที่ต้องการ แล้วกด Run
  // ----------------------------------------------------------
  if (!PASSWORD || PASSWORD === 'CHANGE_ME') {
    throw new Error('กรุณาตั้งค่า PASSWORD ในฟังก์ชัน setCredentials() ก่อนรัน');
  }
  if (!PROPS.getProperty('SECRET')) {
    PROPS.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  PROPS.setProperty('PWHASH', sha256_(PASSWORD));
  return 'OK: ตั้งรหัสผ่านเรียบร้อยแล้ว';
}

/* รันครั้งเดียวเพื่อสร้างหัวตาราง (ไม่บังคับ — getSheet_ สร้างให้อัตโนมัติ) */
function setup() {
  getSheet_();
}

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

/* ---------- token utilities ---------- */
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function sha256_(s) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8));
}
function hmac_(s) {
  return hex_(Utilities.computeHmacSha256Signature(String(s), PROPS.getProperty('SECRET') || ''));
}
function makeToken_() {
  var exp = Date.now() + TOKEN_TTL_MS;
  return exp + '.' + hmac_(exp);
}
function checkToken_(t) {
  if (!t || !PROPS.getProperty('PWHASH')) return false;
  var p = String(t).split('.');
  if (p.length !== 2) return false;
  var exp = Number(p[0]);
  if (!exp || Date.now() > exp) return false;
  return hmac_(p[0]) === p[1];
}

/* ---------- อ่านข้อมูลทั้งหมด → JSON (ต้องมี token) ---------- */
function doGet(e) {
  try {
    if (!checkToken_(e && e.parameter && e.parameter.token)) return json_({ error: 'auth' });
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
    return json_({ error: String(err) });
  }
}

/* ---------- login / เพิ่ม / seed ---------- */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');

    // --- login: ตรวจรหัสผ่าน แล้วออก token ---
    if (body.action === 'login') {
      var ph = PROPS.getProperty('PWHASH');
      if (!ph) return json_({ ok: false, error: 'ยังไม่ได้ตั้งรหัสผ่าน (รัน setCredentials ก่อน)' });
      if (sha256_(String(body.password || '')) === ph) {
        return json_({ ok: true, token: makeToken_() });
      }
      return json_({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // --- ทุก action ที่เหลือต้องมี token ที่ถูกต้อง ---
    if (!checkToken_(body.token)) return json_({ ok: false, error: 'auth' });
    var sh = getSheet_();

    if (body.action === 'add' && body.record) {
      sh.appendRow(rowFromRecord_(body.record));
      return json_({ ok: true });
    }

    if (body.action === 'seed' && Array.isArray(body.records)) {
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
