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

// ไฟล์ Google Sheet ที่ใช้เป็นฐานข้อมูล — ไฟล์ A (มีงานเปลี่ยน 283 รายการอยู่แล้วในแท็บ data)
//   แท็บ data   = งานเปลี่ยนสายพาน
//   แท็บ repair = งานซ่อมสายพาน (สร้างให้อัตโนมัติตอน seed ครั้งแรก)
// ถ้าเว้นว่าง '' จะใช้ไฟล์ที่สคริปต์นี้ผูกอยู่ (getActiveSpreadsheet)
var SPREADSHEET_ID = '1gQBX44ZxKXSs0PoVMttIZf9OL-Ug85szawncDZZJFOU';

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

function getSpreadsheet_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// แท็บที่อนุญาต: งานเปลี่ยน = data, งานซ่อม = repair (ถ้าส่งค่าอื่นมา จะ fallback เป็น data)
var ALLOWED_TABS = { data: 1, repair: 1 };
function tabName_(t) { return (t && ALLOWED_TABS[t]) ? t : SHEET_NAME; }

function getSheet_(tab) {
  var name = tabName_(tab);
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);   // สร้างแท็บอัตโนมัติถ้ายังไม่มี (เช่น repair ครั้งแรก)
    sh.appendRow(FIELDS);
  }
  if (sh.getLastRow() === 0) sh.appendRow(FIELDS);
  return sh;
}

/* รันครั้งเดียว: คัดลอกข้อมูล 283 รายการจากชีตชั่วคราว (ที่เราสร้างตอนแรก)
   มาไว้ในแท็บ data ของไฟล์ฐานข้อมูลใหม่ — แล้วลบฟังก์ชันนี้ทิ้งได้ */
function migrateData() {
  var SOURCE_ID = '1gQBX44ZxKXSs0PoVMttIZf9OL-Ug85szawncDZZJFOU'; // ชีตที่เราสร้างใหม่ตอนแรก
  var src = SpreadsheetApp.openById(SOURCE_ID).getSheetByName(SHEET_NAME);
  if (!src) throw new Error('ไม่พบแท็บ data ในไฟล์ต้นทาง');
  var vals = src.getDataRange().getValues();
  var dst = getSheet_();                 // แท็บ data ของไฟล์ปลายทาง (ไฟล์ใหม่)
  dst.clear();
  dst.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  return 'OK: ย้ายข้อมูล ' + (vals.length - 1) + ' รายการเรียบร้อย';
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
    var sh = getSheet_(e && e.parameter && e.parameter.tab);
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
    var sh = getSheet_(body.tab);

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
