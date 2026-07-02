/**
 * 家計簿Webアプリ - サーバーサイド処理 (Code.gs)  v3
 * --------------------------------------------------
 * シート構成:
 *   "DB"         : 日付, 店名, 商品名, カテゴリ, 個数, 単価, 小計(数式), レシートID, 種別
 *   "Categories" : カテゴリ名, 種別(収入/支出)
 *   "Recurring"  : 名称, 店名, カテゴリ, 個数, 単価, 種別, 課金日   ← v3で追加(固定費)
 *   "Dashboard"  : QUERY関数による自動集計 (任意)
 *   "Settings"   : ログ
 *
 * v3の追加:
 *   - 履歴の取得 / 編集 / 削除  (getEntries / updateEntry / deleteEntry)
 *   - 固定費(定期支出/収入)の管理と自動計上 (Recurring シート + 月次トリガー)
 */

// アプリのバージョン(更新時はここを上げる)
var APP_VERSION = '1.0.0';

// レシート読み取りに使うGeminiモデル(429が出たら別候補に変更)
// 候補: 'gemini-2.0-flash-lite' / 'gemini-2.5-flash-lite' / 'gemini-2.5-flash' / 'gemini-2.0-flash' / 'gemini-1.5-flash'
var GEMINI_MODEL = 'gemini-2.0-flash-lite';

// スプレッドシートID(共有URLの /d/ と /edit の間の文字列)。
// 空ならアクティブなスプレッドシートを使う。設定しておくと権限/構成ズレに強い。
var SPREADSHEET_ID = '1uvOWf0GtWnoCTa2dam4beHmSxvLVMWbP9hYivONOGU8';

var SHEET_DB         = 'DB';
var SHEET_CATEGORIES = 'Categories';
var SHEET_RECURRING  = 'Recurring';
var SHEET_DASHBOARD  = 'Dashboard';
var SHEET_SETTINGS   = 'Settings';

var TYPE_INCOME  = '収入';
var TYPE_EXPENSE = '支出';
var TYPE_SAVING  = '貯蓄';

var COL = {
  DATE: 1, STORE: 2, ITEM: 3, CATEGORY: 4,
  QTY: 5, PRICE: 6, SUBTOTAL: 7, RECEIPT_ID: 8, TYPE: 9, NOTE: 10, ITEMNOTE: 11
};

// ===== エントリポイント =====
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('家計簿')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    // PWA風 (GASのaddMetaTagは許可タグのみ。status-bar/title/themeはここでは設定不可)
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setFaviconUrl('https://www.google.com/images/icons/product/sheets-32.png');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSS_() {
  if (SPREADSHEET_ID) {
    try { return SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) { /* fallback below */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートにアクセスできません。SPREADSHEET_ID を設定し、デプロイの「実行するユーザー」を自分にしてください。');
  return ss;
}
function getSheet_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」が見つかりません。');
  return sh;
}
function normType_(v) {
  v = String(v || '').trim();
  if (v === TYPE_INCOME) return TYPE_INCOME;
  if (v === TYPE_SAVING) return TYPE_SAVING;
  return TYPE_EXPENSE;
}
function typeKey_(v) { var t = normType_(v); return t === TYPE_INCOME ? 'income' : (t === TYPE_SAVING ? 'saving' : 'expense'); }
/** 多重実行を防ぐ簡易ロック */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function toDateStr_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}

// =====================================================
//  カテゴリ管理 (CRUD)
// =====================================================
function getCategories() {
  var sh = getSheet_(SHEET_CATEGORIES);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 2).getValues()
    .map(function (r) { return { name: String(r[0]).trim(), type: normType_(r[1]) }; })
    .filter(function (c) { return c.name !== ''; });
}
function findCategoryRow_(sh, name) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var values = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) if (String(values[i][0]).trim() === name) return i + 2;
  return -1;
}
function addCategory(name, type) {
  name = String(name || '').trim(); type = normType_(type);
  if (!name) throw new Error('カテゴリ名が空です。');
  if (getCategories().some(function (c) { return c.name === name; })) throw new Error('「' + name + '」は既に存在します。');
  getSheet_(SHEET_CATEGORIES).appendRow([name, type]);
  // 支出グループ→収入グループの順に並べ直す(新規は同種別の末尾に入る)
  var cats = getCategories();
  var names = cats.filter(function (c) { return c.type === '支出'; }).map(function (c) { return c.name; })
    .concat(cats.filter(function (c) { return c.type === '収入'; }).map(function (c) { return c.name; }));
  return setCategoryOrder(names);
}
function updateCategory(oldName, newName, type) {
  oldName = String(oldName || '').trim(); newName = String(newName || '').trim(); type = normType_(type);
  if (!oldName || !newName) throw new Error('カテゴリ名が空です。');
  var sh = getSheet_(SHEET_CATEGORIES);
  var row = findCategoryRow_(sh, oldName);
  if (row === -1) throw new Error('「' + oldName + '」が見つかりません。');
  sh.getRange(row, 1, 1, 2).setValues([[newName, type]]);
  if (newName !== oldName) {
    var db = getSheet_(SHEET_DB), dbLast = db.getLastRow();
    if (dbLast >= 2) {
      var range = db.getRange(2, COL.CATEGORY, dbLast - 1, 1), vals = range.getValues(), changed = false;
      for (var j = 0; j < vals.length; j++) if (String(vals[j][0]).trim() === oldName) { vals[j][0] = newName; changed = true; }
      if (changed) range.setValues(vals);
    }
  }
  return getCategories();
}
function deleteCategory(name) {
  name = String(name || '').trim();
  var sh = getSheet_(SHEET_CATEGORIES), row = findCategoryRow_(sh, name);
  if (row === -1) throw new Error('「' + name + '」が見つかりません。');
  sh.deleteRow(row);
  return getCategories();
}

/** カテゴリの並び順を、渡された名前配列の順に一括で書き換える */
function setCategoryOrder(names) {
  var current = getCategories();
  var typeByName = {};
  current.forEach(function (c) { typeByName[c.name] = c.type; });
  // names に無い既存カテゴリは末尾に補完(取りこぼし防止)
  var ordered = (names || []).filter(function (n) { return typeByName.hasOwnProperty(n); });
  current.forEach(function (c) { if (ordered.indexOf(c.name) === -1) ordered.push(c.name); });

  var sh = getSheet_(SHEET_CATEGORIES);
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).clearContent();
  var rows = ordered.map(function (n) { return [n, typeByName[n]]; });
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  return getCategories();
}

/** カテゴリの並び順を1つ上(dir=-1)/下(dir=+1)に移動 */
function moveCategory(name, dir) {
  name = String(name || '').trim();
  dir = Number(dir);
  var sh = getSheet_(SHEET_CATEGORIES);
  var row = findCategoryRow_(sh, name);
  if (row === -1) throw new Error('「' + name + '」が見つかりません。');
  var target = row + dir;
  if (target < 2 || target > sh.getLastRow()) return getCategories(); // 端なら何もしない
  var a = sh.getRange(row, 1, 1, 2).getValues();
  var b = sh.getRange(target, 1, 1, 2).getValues();
  sh.getRange(target, 1, 1, 2).setValues(a);
  sh.getRange(row, 1, 1, 2).setValues(b);
  return getCategories();
}

// =====================================================
//  オートサジェスト
// =====================================================
function getProductSuggestions() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var values = db.getRange(2, COL.ITEM, last - 1, 2).getValues(), map = {};
  for (var i = 0; i < values.length; i++) {
    var item = String(values[i][0]).trim(), cat = String(values[i][1]).trim();
    if (item) map[item] = cat;
  }
  return Object.keys(map).map(function (item) { return { item: item, category: map[item] }; });
}

/** 過去に入力した店名を新しい順・重複なしで返す */
function getStoreSuggestions() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var vals = db.getRange(2, COL.STORE, last - 1, 1).getValues();
  var seen = {}, out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var s = String(vals[i][0]).trim();
    if (s && !seen[s]) { seen[s] = true; out.push(s); }
  }
  return out;
}

// =====================================================
//  レシート登録
// =====================================================
function submitReceipt(payload, force) {
  if (!payload || !payload.items || !payload.items.length) throw new Error('明細がありません。');
  var lock = LockService.getScriptLock();   // 連打・多重登録の防止
  lock.tryLock(10000);
  try {
    var db = getSheet_(SHEET_DB);
    var receiptId = makeReceiptId_();
    var date  = payload.date || toDateStr_(new Date());
    var store = String(payload.store || '').trim();
    var type  = normType_(payload.type);
    var note  = String(payload.note || '').trim();

    // 重複チェック(同じ日付・店・合計)。forceでスキップ。
    if (!force) {
      var total = 0;
      payload.items.forEach(function (it) { total += (Number(it.qty) || 0) * (Number(it.price) || 0); });
      var dup = findDuplicateReceipt_(date, store, total);
      if (dup) return { duplicate: true, total: total };
    }

    var rows = [], startRow = db.getLastRow() + 1;
    for (var i = 0; i < payload.items.length; i++) {
      var it = payload.items[i], item = String(it.item || '').trim();
      if (!item) continue;
      var r = startRow + rows.length;
      rows.push([date, store, item, String(it.category || '').trim(),
        Number(it.qty) || 0, Number(it.price) || 0, '=E' + r + '*F' + r, receiptId, type, note, String(it.note || '').trim()]);
    }
    if (!rows.length) throw new Error('有効な明細がありません。');
    db.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    return { receiptId: receiptId, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}
function makeReceiptId_() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return 'R' + stamp + '-' + ('00' + Math.floor(Math.random() * 1000)).slice(-3);
}

/** 同じ日付・店・合計のレシートが既にあれば情報を返す(無ければnull) */
function findDuplicateReceipt_(date, store, total) {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return null;
  var vals = db.getRange(2, 1, last - 1, COL.TYPE).getValues();
  var sums = {};
  vals.forEach(function (r) {
    if (toDateStr_(r[COL.DATE - 1]) !== date) return;
    if (String(r[COL.STORE - 1] || '').trim() !== String(store).trim()) return;
    var id = String(r[COL.RECEIPT_ID - 1] || '').trim() || ('row' + r[COL.ITEM - 1]);
    sums[id] = (sums[id] || 0) + (Number(r[COL.SUBTOTAL - 1]) || 0);
  });
  for (var id in sums) if (Math.round(sums[id]) === Math.round(total)) return { receiptId: id };
  return null;
}

/** 指定年月・カテゴリの明細(内訳)を新しい順で返す */
function getCategoryEntries(year, month, category) {
  category = String(category || '').trim();
  var ym = year + '-' + ('0' + month).slice(-2);
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var vals = db.getRange(2, 1, last - 1, COL.ITEMNOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (toDateStr_(r[COL.DATE - 1]).slice(0, 7) !== ym) continue;
    var cat = String(r[COL.CATEGORY - 1] || '').trim() || '(未分類)';
    if (cat !== category) continue;
    out.push(entryFromRow_(r, i + 2));
  }
  return out.reverse();
}

/** 全期間から商品名・店名・カテゴリを横断検索(新しい順・最大500件) */
function searchEntries(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var vals = db.getRange(2, 1, last - 1, COL.ITEMNOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var hay = (String(r[COL.ITEM - 1] || '') + ' ' + String(r[COL.STORE - 1] || '') + ' ' + String(r[COL.CATEGORY - 1] || '') + ' ' + String(r[COL.NOTE - 1] || '') + ' ' + String(r[COL.ITEMNOTE - 1] || '')).toLowerCase();
    if (hay.indexOf(q) >= 0) out.push(entryFromRow_(r, i + 2));
  }
  return out.reverse().slice(0, 500);
}

// =====================================================
//  履歴: 取得 / 編集 / 削除
// =====================================================
function entryFromRow_(r, sheetRow) {
  return {
    sheetRow: sheetRow,
    date: toDateStr_(r[COL.DATE - 1]),
    store: String(r[COL.STORE - 1] || ''),
    item: String(r[COL.ITEM - 1] || ''),
    category: String(r[COL.CATEGORY - 1] || ''),
    qty: Number(r[COL.QTY - 1]) || 0,
    price: Number(r[COL.PRICE - 1]) || 0,
    subtotal: Number(r[COL.SUBTOTAL - 1]) || 0,
    receiptId: String(r[COL.RECEIPT_ID - 1] || ''),
    type: normType_(r[COL.TYPE - 1]),
    note: String(r[COL.NOTE - 1] || ''),
    itemNote: String(r[COL.ITEMNOTE - 1] || '')
  };
}

/** 直近 limit 件を新しい順で返す(「全期間」表示用)。 */
function getEntries(limit) {
  limit = limit || 500;
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - limit + 1);
  var n = last - start + 1;
  var vals = db.getRange(start, 1, n, COL.ITEMNOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) out.push(entryFromRow_(vals[i], start + i));
  return out.reverse();
}

/** 指定月(ym='yyyy-MM')の全件を新しい順で返す。件数制限なし。 */
function getEntriesByMonth(ym) {
  ym = String(ym || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) return [];
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return [];
  var vals = db.getRange(2, 1, last - 1, COL.ITEMNOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var ds = toDateStr_(vals[i][COL.DATE - 1]);
    if (ds.slice(0, 7) === ym) out.push(entryFromRow_(vals[i], i + 2));
  }
  return out.reverse();
}

function updateEntry(sheetRow, obj) {
  sheetRow = Number(sheetRow);
  if (!(sheetRow >= 2)) throw new Error('不正な行です。');
  var db = getSheet_(SHEET_DB);
  if (sheetRow > db.getLastRow()) throw new Error('行が存在しません。');
  db.getRange(sheetRow, COL.DATE, 1, 6).setValues([[
    String(obj.date || ''), String(obj.store || ''), String(obj.item || ''),
    String(obj.category || ''), Number(obj.qty) || 0, Number(obj.price) || 0
  ]]);
  db.getRange(sheetRow, COL.SUBTOTAL).setFormula('=E' + sheetRow + '*F' + sheetRow);
  db.getRange(sheetRow, COL.TYPE).setValue(normType_(obj.type));
  if (obj.itemNote !== undefined) db.getRange(sheetRow, COL.ITEMNOTE).setValue(String(obj.itemNote || '').trim());
  return true;
}

function deleteEntry(sheetRow) {
  sheetRow = Number(sheetRow);
  if (!(sheetRow >= 2)) throw new Error('不正な行です。');
  var db = getSheet_(SHEET_DB);
  if (sheetRow > db.getLastRow()) throw new Error('行が存在しません。');
  db.deleteRow(sheetRow);
  return true;
}

/** レシート単位で店名・日付をまとめて更新。receiptIdがあればIDで、無ければrows(行番号配列)で対象を決める。 */
function updateReceiptMeta(receiptId, store, date, rows, note) {
  store = String(store == null ? '' : store).trim();
  date = String(date || '').trim();
  var hasNote = (note !== undefined && note !== null);
  note = String(note || '').trim();
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  var targets = [];
  receiptId = String(receiptId || '').trim();
  if (receiptId && last >= 2) {
    var ids = db.getRange(2, COL.RECEIPT_ID, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === receiptId) targets.push(i + 2);
  } else if (rows && rows.length) {
    targets = rows.map(Number).filter(function (r) { return r >= 2; });
  }
  targets.forEach(function (r) {
    db.getRange(r, COL.STORE).setValue(store);
    if (date) db.getRange(r, COL.DATE).setValue(date);
    if (hasNote) db.getRange(r, COL.NOTE).setValue(note);
  });
  return targets.length;
}

/** 同じレシートID(まとめて登録した1件)の行をすべて削除 */
function deleteReceipt(receiptId) {
  receiptId = String(receiptId || '').trim();
  if (!receiptId) throw new Error('レシートIDがありません。');
  return withLock_(function () {
    var db = getSheet_(SHEET_DB), last = db.getLastRow();
    if (last < 2) return 0;
    var ids = db.getRange(2, COL.RECEIPT_ID, last - 1, 1).getValues();
    var rows = [];
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === receiptId) rows.push(i + 2);
    rows.sort(function (a, b) { return b - a; }); // 下から消す
    rows.forEach(function (r) { db.deleteRow(r); });
    return rows.length;
  });
}

/** 指定年月の収入・支出・収支の合計だけを軽量に返す(入力画面のミニサマリー用) */
function getMonthSummary(year, month) {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  var inc = 0, exp = 0, sav = 0;
  if (last >= 2) {
    db.getRange(2, 1, last - 1, COL.TYPE).getValues().forEach(function (r) {
      var d = r[COL.DATE - 1]; if (!d) return;
      var dt = (d instanceof Date) ? d : new Date(d); if (isNaN(dt.getTime())) return;
      if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
        var amt = Number(r[COL.SUBTOTAL - 1]) || 0;
        var t = typeKey_(r[COL.TYPE - 1]);
        if (t === 'income') inc += amt; else if (t === 'saving') sav += amt; else exp += amt;
      }
    });
  }
  return { income: inc, expense: exp, saving: sav, balance: inc - exp };
}

/** 指定年月の日別 収入/支出 合計を返す(カレンダー表示用)。 */
function getDailyTotals(year, month) {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  var days = {};
  if (last >= 2) {
    db.getRange(2, 1, last - 1, COL.TYPE).getValues().forEach(function (r) {
      var d = r[COL.DATE - 1]; if (!d) return;
      var dt = (d instanceof Date) ? d : new Date(d); if (isNaN(dt.getTime())) return;
      if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
        var day = dt.getDate();
        var amt = Number(r[COL.SUBTOTAL - 1]) || 0;
        var rec = days[day] || (days[day] = { income: 0, expense: 0 });
        if (normType_(r[COL.TYPE - 1]) === TYPE_INCOME) rec.income += amt; else rec.expense += amt;
      }
    });
  }
  return days; // { 1:{income,expense}, 15:{...} }
}

/** 直近に登録したレシート(同一レシートID)の明細を返す。「前回と同じ」呼び出し用。 */
function getLastReceipt() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 2) return null;
  var vals = db.getRange(2, 1, last - 1, COL.TYPE).getValues();
  var lastId = String(vals[vals.length - 1][COL.RECEIPT_ID - 1]).trim();
  var store = '', type = TYPE_EXPENSE, items = [];
  vals.forEach(function (r) {
    if (String(r[COL.RECEIPT_ID - 1]).trim() === lastId) {
      store = String(r[COL.STORE - 1] || '');
      type = normType_(r[COL.TYPE - 1]);
      items.push({ item: String(r[COL.ITEM - 1] || ''), category: String(r[COL.CATEGORY - 1] || ''), qty: Number(r[COL.QTY - 1]) || 1, price: Number(r[COL.PRICE - 1]) || 0 });
    }
  });
  return { store: store, type: type, items: items };
}

// =====================================================
//  固定費 (定期支出/収入)
// =====================================================
function getRecurring() {
  var sh = getSheet_(SHEET_RECURRING), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 7).getValues(), out = [];
  var now = new Date();
  var ym = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2);
  var posted = getPostedFixIds_();
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!String(r[0]).trim()) continue;
    var name = String(r[0]).trim();
    out.push({
      sheetRow: i + 2,
      name: name, store: String(r[1] || ''),
      category: String(r[2] || ''), qty: Number(r[3]) || 1,
      price: Number(r[4]) || 0, type: normType_(r[5]), day: Number(r[6]) || 1,
      posted: posted['FIX-' + ym + '-' + name] === true // 今月計上済みか
    });
  }
  return out;
}
/** DB内の固定費計上ID(FIX-...)の集合を返す */
function getPostedFixIds_() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow(), set = {};
  if (last < 2) return set;
  db.getRange(2, COL.RECEIPT_ID, last - 1, 1).getValues().forEach(function (r) {
    var id = String(r[0]).trim();
    if (id.indexOf('FIX-') === 0) set[id] = true;
  });
  return set;
}
/** 固定費の自動計上ログ(Settingsシート)を新しい順で返す */
function getRecurringLog() {
  try {
    var sh = getSheet_(SHEET_SETTINGS), last = sh.getLastRow();
    if (last < 1) return [];
    var vals = sh.getRange(1, 1, last, 3).getValues(), out = [];
    vals.forEach(function (r) {
      if (String(r[0]).trim() === 'RECURRING') out.push({ info: String(r[1] || ''), at: toDateStr_(r[2]) });
    });
    return out.reverse().slice(0, 10);
  } catch (e) { return []; }
}
function addRecurring(o) {
  if (!String(o.name || '').trim()) throw new Error('名称が必要です。');
  getSheet_(SHEET_RECURRING).appendRow([
    String(o.name).trim(), String(o.store || ''), String(o.category || ''),
    Number(o.qty) || 1, Number(o.price) || 0, normType_(o.type), Number(o.day) || 1
  ]);
  return getRecurring();
}
function updateRecurring(sheetRow, o) {
  sheetRow = Number(sheetRow);
  var sh = getSheet_(SHEET_RECURRING);
  sh.getRange(sheetRow, 1, 1, 7).setValues([[
    String(o.name).trim(), String(o.store || ''), String(o.category || ''),
    Number(o.qty) || 1, Number(o.price) || 0, normType_(o.type), Number(o.day) || 1
  ]]);
  return getRecurring();
}
function deleteRecurring(sheetRow) {
  getSheet_(SHEET_RECURRING).deleteRow(Number(sheetRow));
  return getRecurring();
}

/** 指定年月の固定費を計上(重複は自動スキップ)。追加件数を返す。 */
function applyRecurringForMonth(year, month) {
  var list = getRecurring();
  if (!list.length) return 0;
  var db = getSheet_(SHEET_DB);
  var last = db.getLastRow();
  var existing = {};
  if (last >= 2) {
    db.getRange(2, COL.RECEIPT_ID, last - 1, 1).getValues()
      .forEach(function (r) { existing[String(r[0]).trim()] = true; });
  }
  var ym = year + ('0' + month).slice(-2);
  var daysInMonth = new Date(year, month, 0).getDate();
  var rows = [], startRow = db.getLastRow() + 1;
  list.forEach(function (rec) {
    var id = 'FIX-' + ym + '-' + rec.name;
    if (existing[id]) return; // 既に計上済み
    var day = Math.min(Math.max(1, rec.day), daysInMonth);
    var date = year + '-' + ('0' + month).slice(-2) + '-' + ('0' + day).slice(-2);
    var r = startRow + rows.length;
    rows.push([date, rec.store, rec.name, rec.category,
      rec.qty, rec.price, '=E' + r + '*F' + r, id, rec.type]);
  });
  if (rows.length) {
    db.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    try { getSheet_(SHEET_SETTINGS).appendRow(['RECURRING', year + '-' + ('0' + month).slice(-2) + ' を ' + rows.length + '件 計上', new Date()]); } catch (e) {}
  }
  return rows.length;
}

/** 「今すぐ今月分を計上」用 */
function applyRecurringNow() {
  var d = new Date();
  var n = applyRecurringForMonth(d.getFullYear(), d.getMonth() + 1);
  return n;
}

/** 月次トリガー本体(自動実行される) */
function monthlyRecurringJob() {
  var d = new Date();
  applyRecurringForMonth(d.getFullYear(), d.getMonth() + 1);
}

/** 毎月1日に自動計上するトリガーを設定(重複作成しない) */
function setupMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monthlyRecurringJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('monthlyRecurringJob').timeBased().onMonthDay(1).atHour(6).create();
  return '毎月1日 朝に自動計上するよう設定しました。';
}
function removeMonthlyTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monthlyRecurringJob') { ScriptApp.deleteTrigger(t); removed++; }
  });
  return removed > 0 ? '自動計上をオフにしました。' : '自動計上は設定されていません。';
}
function isMonthlyTriggerOn() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'monthlyRecurringJob'; });
}

// =====================================================
//  貯蓄目標
// =====================================================
function getSavingGoals() {
  try {
    var g = JSON.parse(PropertiesService.getScriptProperties().getProperty('SAVING_GOALS') || '{}');
    // 旧形式(数値=最終額)を {final, monthly} に正規化
    Object.keys(g).forEach(function (k) { if (typeof g[k] === 'number') g[k] = { final: g[k], monthly: 0 }; });
    return g;
  } catch (e) { return {}; }
}
/** カテゴリ別 貯蓄目標を設定。final/monthly/current すべて0なら解除。 */
function saveSavingGoal(category, finalGoal, monthlyGoal, current) {
  category = String(category || '').trim();
  if (!category) throw new Error('カテゴリを指定してください。');
  var g = getSavingGoals();
  finalGoal = Number(finalGoal) || 0;
  monthlyGoal = Number(monthlyGoal) || 0;
  current = Number(current) || 0;
  if (finalGoal > 0 || monthlyGoal > 0 || current > 0) g[category] = { final: finalGoal, monthly: monthlyGoal, current: current };
  else delete g[category];
  PropertiesService.getScriptProperties().setProperty('SAVING_GOALS', JSON.stringify(g));
  return getSavingProgress();
}
/** カテゴリ別の貯蓄累計と目標を返す */
function getSavingProgress() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow(), totals = {};
  if (last >= 2) {
    db.getRange(2, 1, last - 1, COL.TYPE).getValues().forEach(function (r) {
      if (typeKey_(r[COL.TYPE - 1]) !== 'saving') return;
      var cat = String(r[COL.CATEGORY - 1] || '').trim() || '(未分類)';
      totals[cat] = (totals[cat] || 0) + (Number(r[COL.SUBTOTAL - 1]) || 0);
    });
  }
  return { goals: getSavingGoals(), totals: totals };
}

// =====================================================
//  クレジット / 引き落とし管理  ※スクリプトプロパティ保存(シート不要)
// =====================================================
function getDebits() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DEBITS') || '[]'); } catch (e) { return []; }
}
function saveDebits_(arr) { PropertiesService.getScriptProperties().setProperty('DEBITS', JSON.stringify(arr)); }
function getDebitMonthly_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DEBIT_MONTHLY') || '{}'); } catch (e) { return {}; }
}
function saveDebitMonthly_(m) { PropertiesService.getScriptProperties().setProperty('DEBIT_MONTHLY', JSON.stringify(m)); }

function addDebit(o) {
  var name = String(o.name || '').trim();
  if (!name) throw new Error('名称を入力してください。');
  var arr = getDebits();
  arr.push({
    id: 'D' + Date.now() + Math.floor(Math.random() * 1000),
    name: name,
    day: Math.min(31, Math.max(1, Number(o.day) || 1)),
    type: o.type === 'variable' ? 'variable' : 'fixed',
    amount: Number(o.amount) || 0
  });
  saveDebits_(arr);
  return arr;
}
function updateDebit(id, o) {
  var arr = getDebits();
  arr.forEach(function (d) {
    if (d.id !== id) return;
    d.name = String(o.name || '').trim();
    d.day = Math.min(31, Math.max(1, Number(o.day) || 1));
    d.type = o.type === 'variable' ? 'variable' : 'fixed';
    d.amount = Number(o.amount) || 0;
  });
  saveDebits_(arr);
  return arr;
}
function deleteDebit(id) {
  saveDebits_(getDebits().filter(function (d) { return d.id !== id; }));
  var m = getDebitMonthly_(); delete m[id]; saveDebitMonthly_(m);
  return getDebits();
}
/** 毎月入力タイプの当月金額を保存 */
function setDebitAmount(id, ym, amount) {
  var m = getDebitMonthly_();
  (m[id] = m[id] || {})[ym] = Number(amount) || 0;
  saveDebitMonthly_(m);
  return getDebitMonth(ym);
}
/** 引き落とし設定＋毎月金額をCSV化(バックアップ/エクスポート用) */
function exportDebitsCsv() {
  function cell(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  var arr = getDebits(), mm = getDebitMonthly_(), lines = [];
  lines.push('# 項目');
  lines.push(['ID', '名称', '引落日', '種別', '固定金額'].map(cell).join(','));
  arr.forEach(function (d) { lines.push([d.id, d.name, d.day, d.type, d.amount].map(cell).join(',')); });
  lines.push('');
  lines.push('# 毎月入力の金額');
  lines.push(['ID', '年月', '金額'].map(cell).join(','));
  Object.keys(mm).forEach(function (id) { Object.keys(mm[id]).forEach(function (ym) { lines.push([id, ym, mm[id][ym]].map(cell).join(',')); }); });
  return lines.join('\r\n');
}

/** 指定年月(yyyy-MM)の引き落とし一覧と合計を返す */
function getDebitMonth(ym) {
  ym = String(ym || '').trim();
  var arr = getDebits(), mm = getDebitMonthly_();
  var items = arr.map(function (d) {
    var amt = d.type === 'variable' ? (Number((mm[d.id] || {})[ym]) || 0) : d.amount;
    return { id: d.id, name: d.name, day: d.day, type: d.type, baseAmount: d.amount, amount: amt };
  }).sort(function (a, b) { return a.day - b.day; });
  var total = items.reduce(function (s, i) { return s + i.amount; }, 0);
  return { ym: ym, items: items, total: total };
}

// =====================================================
//  分析
// =====================================================
function getAnalytics(year, month) {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  var rows = last >= 2 ? db.getRange(2, 1, last - 1, COL.TYPE).getValues() : [];
  var monthAgg = {}, yearAgg = {}, catMonth = {}, yearsSet = {};
  var yearCat = {}; // 選択年のカテゴリ別: cat -> { income:[13], expense:[13], saving:[13] }
  function bucket() { return { income: 0, expense: 0, saving: 0 }; }
  rows.forEach(function (r) {
    var d = r[COL.DATE - 1];
    if (!d) return;
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return;
    var y = dt.getFullYear(), m = dt.getMonth() + 1, ym = y + '-' + m;
    var cat = String(r[COL.CATEGORY - 1] || '').trim() || '(未分類)';
    var amt = Number(r[COL.SUBTOTAL - 1]) || 0;
    var t = typeKey_(r[COL.TYPE - 1]); // 'income' | 'expense' | 'saving'
    yearsSet[y] = true;
    (monthAgg[ym] = monthAgg[ym] || bucket())[t] += amt;
    (yearAgg[y]  = yearAgg[y]  || bucket())[t] += amt;
    catMonth[ym] = catMonth[ym] || {};
    (catMonth[ym][cat] = catMonth[ym][cat] || bucket())[t] += amt;
    if (y === year) {
      var yc = yearCat[cat] || (yearCat[cat] = { income: zeros13_(), expense: zeros13_(), saving: zeros13_() });
      yc[t][m] += amt;
    }
  });
  function sum(o) { o = o || bucket(); return { income: o.income, expense: o.expense, saving: o.saving, balance: o.income - o.expense }; }
  function prevMonthKey(y, m) { return m === 1 ? (y - 1) + '-12' : y + '-' + (m - 1); }

  var curKey = year + '-' + month, prevKey = prevMonthKey(year, month);
  var trend = [];
  for (var mo = 1; mo <= 12; mo++) {
    var s = sum(monthAgg[year + '-' + mo]);
    trend.push({ month: mo, income: s.income, expense: s.expense, saving: s.saving, balance: s.balance });
  }
  var thisCats = catMonth[curKey] || {}, prevCats = catMonth[prevKey] || {}, names = {};
  Object.keys(thisCats).forEach(function (n) { names[n] = true; });
  Object.keys(prevCats).forEach(function (n) { names[n] = true; });
  var categories = Object.keys(names).map(function (n) {
    var c = sum(thisCats[n]), p = sum(prevCats[n]);
    return { name: n, income: c.income, expense: c.expense, saving: c.saving, balance: c.balance,
      prevIncome: p.income, prevExpense: p.expense, prevSaving: p.saving };
  });

  var years = Object.keys(yearsSet).map(Number).sort(function (a, b) { return b - a; });
  if (years.indexOf(year) === -1) years.unshift(year);

  // 年間カテゴリ別集計 + カテゴリごとの月別推移
  var yearCategories = Object.keys(yearCat).map(function (n) {
    var inc = yearCat[n].income, exp = yearCat[n].expense, sav = yearCat[n].saving;
    var incTotal = 0, expTotal = 0, savTotal = 0, monthly = [];
    for (var mm = 1; mm <= 12; mm++) {
      incTotal += inc[mm]; expTotal += exp[mm]; savTotal += sav[mm];
      monthly.push({ month: mm, income: inc[mm], expense: exp[mm], saving: sav[mm], balance: inc[mm] - exp[mm] });
    }
    return { name: n, income: incTotal, expense: expTotal, saving: savTotal, balance: incTotal - expTotal, monthly: monthly };
  });

  return {
    year: year, month: month,
    monthCur: sum(monthAgg[curKey]), monthPrev: sum(monthAgg[prevKey]),
    yearCur: sum(yearAgg[year]), yearPrev: sum(yearAgg[year - 1]),
    trend: trend, categories: categories, yearCategories: yearCategories, years: years,
    savingProgress: getSavingProgress()
  };
}
function zeros13_() { return [0,0,0,0,0,0,0,0,0,0,0,0,0]; }

// =====================================================
//  レシート読み取り (Gemini)
// =====================================================

/** GeminiのAPIキー(スクリプトプロパティ GEMINI_API_KEY)を返す */
function getGeminiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('APIキーが未設定です。プロジェクトの設定→スクリプトプロパティに GEMINI_API_KEY を登録してください。');
  return key;
}

/**
 * レシート画像(base64)をGeminiに渡し、明細を構造化して返す。
 * 戻り値: { store, date, type, total, items:[{item, category, qty, price}] }
 */
function scanReceipt(base64, mimeType) {
  if (!base64) throw new Error('画像がありません。');
  var key = getGeminiKey_();

  // カテゴリ候補をAIに渡して、近いものを選ばせる
  var cats = getCategories();
  var exCats = cats.filter(function (c) { return c.type === '支出'; }).map(function (c) { return c.name; });
  var inCats = cats.filter(function (c) { return c.type === '収入'; }).map(function (c) { return c.name; });
  var today = toDateStr_(new Date());

  var prompt =
    'あなたは日本のレシート読み取りアシスタントです。画像のレシートを解析し、JSONのみを出力してください。\n' +
    '出力フォーマット: {"store":string,"date":"yyyy-MM-dd","type":"支出"|"収入","total":number,"items":[{"item":string,"category":string,"qty":number,"price":number}]}\n' +
    '規則:\n' +
    '- price は1個あたりの税込単価、qty は個数(不明なら1)。\n' +
    '- category は次の候補から最も近いものを選ぶ。該当が無ければ空文字。\n' +
    '  支出カテゴリ候補: ' + JSON.stringify(exCats) + '\n' +
    '  収入カテゴリ候補: ' + JSON.stringify(inCats) + '\n' +
    '- store は店名を「支店名・店舗名」まで含めて正確に(例: "イオン 〇〇店", "セブン-イレブン 〇〇店")。ロゴや見出し付近の店舗名を優先。\n' +
    '- 通常レシートは type="支出"。\n' +
    '- 日付が読めない場合は "' + today + '" を使う。\n' +
    '- 値引き・小計・合計・お預り・お釣りなどは items に含めない(商品行のみ)。\n' +
    '- total はレシートの合計金額(読めなければ items の合計)。\n' +
    'JSON以外は一切出力しないこと。';

  var payload = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }
    ] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0 }
  };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code !== 200) {
    throw new Error('Gemini APIエラー(' + code + '): ' + body.slice(0, 300));
  }
  var json = JSON.parse(body);
  if (!json.candidates || !json.candidates.length) throw new Error('読み取り結果が空でした。撮り直してください。');
  var text = json.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
  var parsed;
  try { parsed = JSON.parse(text); }
  catch (e) {
    var m = text.match(/\{[\s\S]*\}/); // 念のため波括弧を抽出
    if (!m) throw new Error('AIの応答を解析できませんでした。');
    parsed = JSON.parse(m[0]);
  }
  // 正規化
  parsed.items = (parsed.items || []).map(function (it) {
    return { item: String(it.item || '').trim(), category: String(it.category || '').trim(), qty: Number(it.qty) || 1, price: Number(it.price) || 0 };
  }).filter(function (it) { return it.item; });
  parsed.store = String(parsed.store || '').trim();
  parsed.type = (String(parsed.type || '').trim() === '収入') ? '収入' : '支出';
  parsed.date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;
  parsed.total = Number(parsed.total) || 0;
  return parsed;
}

/** APIキーが設定済みかをクライアントへ伝える */
function isReceiptScanEnabled() {
  return !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

// =====================================================
//  エクスポート / バックアップ / 初期データ
// =====================================================
function exportDbAsCsv() {
  var db = getSheet_(SHEET_DB), last = db.getLastRow();
  if (last < 1) return '';
  return db.getRange(1, 1, last, COL.ITEMNOTE).getDisplayValues().map(function (row) {
    return row.map(function (cell) {
      var s = String(cell == null ? '' : cell);
      if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  }).join('\r\n');
}
/** DBのCSVを自分のメールアドレスに添付して送信(iPhoneのダウンロード不可対策) */
function emailCsv() {
  var csv = exportDbAsCsv();
  if (!csv) throw new Error('データがありません。');
  var email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('メールアドレスを取得できませんでした。');
  var name = 'kakeibo_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '.csv';
  var blob = Utilities.newBlob('﻿' + csv, 'text/csv', name); // BOM付き(Excel文字化け防止)
  MailApp.sendEmail({ to: email, subject: '家計簿データ ' + name, body: '家計簿のCSVを添付します。', attachments: [blob] });
  return email;
}

function backupDb() {
  var ss = getSS_(), db = getSheet_(SHEET_DB);
  var name = 'Backup_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  db.copyTo(ss).setName(name);
  try { getSheet_(SHEET_SETTINGS).appendRow(['BACKUP', name, new Date()]); } catch (e) {}
  return name;
}
function getInitialData() {
  var now = new Date();
  return {
    categories: getCategories(),
    suggestions: getProductSuggestions(),
    stores: getStoreSuggestions(),
    today: toDateStr_(now),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    monthSummary: getMonthSummary(now.getFullYear(), now.getMonth() + 1),
    triggerOn: isMonthlyTriggerOn(),
    scanEnabled: isReceiptScanEnabled(),
    version: APP_VERSION
  };
}
