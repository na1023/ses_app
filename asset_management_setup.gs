/**
 * 資産・負債 自動管理システム セットアップスクリプト
 *
 * ▼ 使い方
 *   1. Googleスプレッドシートを新規作成する
 *   2. メニュー「拡張機能」→「Apps Script」を開く
 *   3. 表示されたコードをすべて削除し、このファイルの内容を貼り付けて保存
 *   4. 上部のドロップダウンから「setupAssetManagementSystem」を選択して ▶ 実行
 *   5. 「アクセスを承認」ダイアログが出たら許可する（初回のみ）
 *   6. 完了メッセージが出たらスプレッドシートに戻る
 *
 * ▼ セットアップ後にやること（2ステップ）
 *   ①「管理」シートの C10・C11・C12 に各借入の当初金額を入力
 *   ②「入力」シートのサンプル行（2〜4行目）を自分のデータに書き換える
 *     ※ 5行目以降に毎月1行ずつ追加していく運用になります
 */

// ─────────────────────────────────────────────────────────────
//  メイン関数
// ─────────────────────────────────────────────────────────────
function setupAssetManagementSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // シートを作成 or 既存を取得
  const inputSheet      = getOrCreateSheet(ss, '入力',  0);
  const managementSheet = getOrCreateSheet(ss, '管理',  1);
  const historySheet    = getOrCreateSheet(ss, '履歴',  2);

  // 各シートをセットアップ
  setupInputSheet(inputSheet);
  setupManagementSheet(managementSheet);
  setupHistorySheet(historySheet);

  // デフォルトで作成される「シート1」を削除
  ['Sheet1', 'シート1'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) { try { ss.deleteSheet(s); } catch (_) {} }
  });

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了！\n\n' +
    '次にやること:\n' +
    '①「管理」シートの C10〜C12 に各借入の当初金額を入力\n' +
    '②「入力」シートのサンプルを自分のデータに書き換え\n' +
    '  （毎月末に新しい行を 1 行追加する運用です）'
  );
}

// シートを取得、なければ指定位置に新規作成
function getOrCreateSheet(ss, name, position) {
  return ss.getSheetByName(name) || ss.insertSheet(name, position);
}


// ─────────────────────────────────────────────────────────────
//  入力シート：毎月手入力するシート
// ─────────────────────────────────────────────────────────────
function setupInputSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ── ヘッダー行 ──
  sheet.getRange('A1:G1')
    .setValues([['年月', 'SBI元本', '楽天元本', '現金', 'ローン残高', '奨学金残高', '親借金残高']])
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // ── サンプルデータ（3ヶ月分）──
  // あとで自分のデータに書き換えてください
  sheet.getRange('A2:G4').setValues([
    [new Date(2024, 3, 1), 500000, 300000,  80000, 1480000, 780000, 280000],
    [new Date(2024, 4, 1), 520000, 310000,  65000, 1460000, 760000, 280000],
    [new Date(2024, 5, 1), 540000, 320000,  90000, 1440000, 740000, 260000],
  ]);

  // ── 書式 ──
  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:G1000').setNumberFormat('#,##0');

  // ── 列幅・ヘッダー固定 ──
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 6, 115);
  sheet.setFrozenRows(1);

  // ── 入力ガイド ──
  sheet.getRange('A1').setNote(
    '年月の入力形式: 2024/6/1（日付型）\nセルの表示は「2024年06月」になります\n毎月末に新しい行を1行追加してください'
  );
}


// ─────────────────────────────────────────────────────────────
//  管理シート：最新データのダッシュボード
// ─────────────────────────────────────────────────────────────
function setupManagementSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ── A列ラベル ──
  const labels = {
    1:  '更新月',
    3:  '資産',
    4:  'SBI元本',
    5:  '楽天元本',
    6:  '現金',
    7:  '資産合計',
    9:  '負債',
    10: 'ローン残高',
    11: '奨学金残高',
    12: '親借金残高',
    13: '負債合計',
    15: '純資産',
    16: '純資産率',
  };
  Object.entries(labels).forEach(([row, label]) => {
    sheet.getRange(`A${row}`).setValue(label);
  });
  sheet.getRange('A1:A16').setHorizontalAlignment('right').setFontSize(11);

  // ── B列：最新値を自動取得する数式 ──
  // LOOKUP(2, 1/(A列が空でない), 対象列) で最後の非空行を取得
  const lookup = (col) =>
    `=IFERROR(LOOKUP(2,1/(入力!A$2:A<>""),入力!${col}$2:${col}),0)`;

  sheet.getRange('B1').setFormula(
    '=IFERROR(LOOKUP(2,1/(入力!A$2:A<>""),入力!A$2:A),"データなし")'
  );
  sheet.getRange('B4').setFormula(lookup('B'));   // SBI元本
  sheet.getRange('B5').setFormula(lookup('C'));   // 楽天元本
  sheet.getRange('B6').setFormula(lookup('D'));   // 現金
  sheet.getRange('B7').setFormula('=SUM(B4:B6)');  // 資産合計

  sheet.getRange('B10').setFormula(lookup('E'));  // ローン残高
  sheet.getRange('B11').setFormula(lookup('F'));  // 奨学金残高
  sheet.getRange('B12').setFormula(lookup('G'));  // 親借金残高
  sheet.getRange('B13').setFormula('=SUM(B10:B12)'); // 負債合計

  sheet.getRange('B15').setFormula('=B7-B13');          // 純資産
  sheet.getRange('B16').setFormula('=IFERROR(B15/B7,0)'); // 純資産率

  // ── C9:E9：返済進捗ヘッダー ──
  sheet.getRange('C9:E9')
    .setValues([['当初借入額', '返済済み率', '進捗バー']])
    .setFontWeight('bold')
    .setBackground('#f5f5f5')
    .setHorizontalAlignment('center');

  // ── C10:C12：当初借入額（手入力セル・黄色） ──
  sheet.getRange('C10:C12')
    .setBackground('#fff9c4')
    .setNumberFormat('¥#,##0');

  sheet.getRange('C10').setNote('ローンの当初借入額を入力\n例: 1500000');
  sheet.getRange('C11').setNote('奨学金の当初借入額を入力\n例: 800000');
  sheet.getRange('C12').setNote('親への借入の当初額を入力\n例: 300000');

  // ── D10:D12：返済済み率 ──
  [10, 11, 12].forEach(row => {
    sheet.getRange(`D${row}`).setFormula(`=IFERROR(1-B${row}/C${row},"—")`);
  });
  sheet.getRange('D10:D12').setNumberFormat('0.0%');

  // ── E10:E12：進捗バー（SPARKLINE） ──
  [10, 11, 12].forEach(row => {
    sheet.getRange(`E${row}`).setFormula(
      `=IF(ISNUMBER(D${row}),` +
      `SPARKLINE(D${row},{"charttype","bar";"max",1;"color1","#34a853";"color2","#eeeeee"}),` +
      `"← C${row} に当初借入額を入力")`
    );
  });

  // ── 書式：更新月 ──
  sheet.getRange('A1').setFontWeight('bold');
  sheet.getRange('B1').setNumberFormat('yyyy年mm月').setFontWeight('bold');

  // ── 書式：資産セクション ──
  sheet.getRange('A3')
    .setBackground('#e8f0fe').setFontColor('#1967d2').setFontWeight('bold');
  sheet.getRange('B4:B6').setNumberFormat('¥#,##0');
  sheet.getRange('A7:B7')
    .setBackground('#c2d7f8').setFontWeight('bold');
  sheet.getRange('B7').setNumberFormat('¥#,##0');

  // ── 書式：負債セクション ──
  sheet.getRange('A9')
    .setBackground('#fce8e6').setFontColor('#c5221f').setFontWeight('bold');
  sheet.getRange('B10:B12').setNumberFormat('¥#,##0');
  sheet.getRange('A13:B13')
    .setBackground('#f4b8b5').setFontWeight('bold');
  sheet.getRange('B13').setNumberFormat('¥#,##0');

  // ── 書式：純資産・純資産率 ──
  sheet.getRange('A15:B16').setBackground('#e6f4ea').setFontWeight('bold');
  sheet.getRange('B15').setNumberFormat('¥#,##0');
  sheet.getRange('B16').setNumberFormat('0.0%');

  // ── 列幅 ──
  sheet.setColumnWidth(1, 105);  // A: ラベル
  sheet.setColumnWidth(2, 115);  // B: 最新値
  sheet.setColumnWidth(3, 120);  // C: 当初借入額
  sheet.setColumnWidth(4,  90);  // D: 返済済み率
  sheet.setColumnWidth(5, 200);  // E: 進捗バー
}


// ─────────────────────────────────────────────────────────────
//  履歴シート：全期間の推移データ（グラフ元データ）
// ─────────────────────────────────────────────────────────────
function setupHistorySheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ── ヘッダー行 ──
  sheet.getRange('A1:K1')
    .setValues([[
      '年月', 'SBI元本', '楽天元本', '現金', '資産合計',
      'ローン残高', '奨学金残高', '親借金残高', '負債合計',
      '純資産', '純資産率'
    ]])
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // ── A2セル：1つのARRAYFORMULAで全行・全列を自動展開 ──
  //
  // 入力シートに行を追加するだけで履歴が自動的に伸びます
  // 計算内容:
  //   E列(資産合計)   = SBI元本 + 楽天元本 + 現金
  //   I列(負債合計)   = ローン + 奨学金 + 親借金
  //   J列(純資産)     = 資産合計 - 負債合計
  //   K列(純資産率)   = 純資産 ÷ 資産合計
  //
  const i = {
    date:   '入力!A2:A',
    sbi:    '入力!B2:B',
    raku:   '入力!C2:C',
    cash:   '入力!D2:D',
    loan:   '入力!E2:E',
    gaku:   '入力!F2:F',
    parent: '入力!G2:G',
  };
  const asset    = `${i.sbi}+${i.raku}+${i.cash}`;
  const debt     = `${i.loan}+${i.gaku}+${i.parent}`;
  const netAsset = `(${asset})-(${debt})`;
  const netRate  = `IFERROR((${netAsset})/(${asset}),"")`;

  // 数値列に +0 を付けることで空セルを 0 として扱う
  sheet.getRange('A2').setFormula(
    `=ARRAYFORMULA(` +
    `IF(${i.date}="","",` +
    `{${i.date},` +
    `${i.sbi}+0,${i.raku}+0,${i.cash}+0,${asset},` +
    `${i.loan}+0,${i.gaku}+0,${i.parent}+0,${debt},` +
    `${netAsset},${netRate}}))`
  );

  // ── 書式 ──
  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:J1000').setNumberFormat('#,##0');
  sheet.getRange('K2:K1000').setNumberFormat('0.0%');

  // ── 列幅・ヘッダー固定 ──
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 10, 110);
  sheet.setFrozenRows(1);
}

/**
 * ─────────────────────────────────────────────────────────────
 *  グラフ作成手順（セットアップ後に手動で一度だけ実施）
 * ─────────────────────────────────────────────────────────────
 *
 *  1.「履歴」シートを開く
 *
 *  2. 折れ線グラフ（純資産の推移）:
 *     ① A列（年月）を選択
 *     ② Ctrl を押しながら J列（純資産）を選択
 *     ③ メニュー「挿入」→「グラフ」
 *     ④ グラフの種類: 折れ線グラフ
 *     ⑤ X軸: 列 A（年月）
 *
 *  3. 資産・負債も重ねて見たい場合:
 *     グラフエディタの「+ 系列を追加」で
 *     E列（資産合計）と I列（負債合計）を追加
 *
 *  4. グラフを「管理」シートに移動すると一覧で確認しやすい:
 *     グラフ右上「⋮」→「グラフを移動」→「別のシートに移動」
 * ─────────────────────────────────────────────────────────────
 */
