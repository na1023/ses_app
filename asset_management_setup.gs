/**
 * 資産・負債 自動管理システム セットアップスクリプト
 *
 * ▼ 使い方
 *   1. Googleスプレッドシートを新規作成する
 *   2. メニュー「拡張機能」→「Apps Script」を開く
 *   3. 表示されたコードをすべて削除し、このスクリプトを貼り付けて保存
 *   4. 上部のドロップダウンから「setupAssetManagementSystem」を選んで ▶ 実行
 *   5. 「アクセスを承認」が出たら許可（初回のみ）
 *   6. 完了ダイアログが出たらスプレッドシートへ戻る
 *
 * ▼ セットアップ後にやること
 *   ①「管理」シートの C10〜C12（黄色セル）に各借入の当初金額を入力
 *   ②「入力」シートの 2〜4 行目のサンプルを自分のデータに書き換え
 *     （5 行目以降に毎月 1 行ずつ追加していく運用です）
 */

// ─────────────────────────────────────────────────────────────
//  メイン
// ─────────────────────────────────────────────────────────────
function setupAssetManagementSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const inputSheet      = getOrCreateSheet(ss, '入力', 0);
  const managementSheet = getOrCreateSheet(ss, '管理', 1);
  const historySheet    = getOrCreateSheet(ss, '履歴', 2);

  setupInputSheet(inputSheet);
  setupManagementSheet(managementSheet);
  setupHistorySheet(historySheet);

  // デフォルトシートを削除
  ['Sheet1', 'シート1'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) { try { ss.deleteSheet(s); } catch (_) {} }
  });

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了！\n\n' +
    '次にやること:\n' +
    '①「管理」C10〜C12（黄色）に各借入の当初金額を入力\n' +
    '②「入力」2〜4 行目のサンプルを自分のデータに書き換え'
  );
}

function getOrCreateSheet(ss, name, position) {
  return ss.getSheetByName(name) || ss.insertSheet(name, position);
}


// ─────────────────────────────────────────────────────────────
//  入力シート
// ─────────────────────────────────────────────────────────────
function setupInputSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ヘッダー＋サンプルデータをまとめて 1 回でセット
  sheet.getRange('A1:G4').setValues([
    ['年月',              'SBI元本', '楽天元本', '現金', 'ローン残高', '奨学金残高', '親借金残高'],
    [new Date(2024,3,1),  500000,    300000,     80000,  1480000,      780000,       280000],
    [new Date(2024,4,1),  520000,    310000,     65000,  1460000,      760000,       280000],
    [new Date(2024,5,1),  540000,    320000,     90000,  1440000,      740000,       260000],
  ]);

  // 書式
  sheet.getRange('A1:G1')
    .setBackground('#1a73e8').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:G1000').setNumberFormat('#,##0');

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 6, 115);
  sheet.setFrozenRows(1);
  sheet.getRange('A1').setNote('年月: 2024/6/1 と入力（表示は「2024年06月」）\n毎月末に新しい行を 1 行追加してください');
}


// ─────────────────────────────────────────────────────────────
//  管理シート
// ─────────────────────────────────────────────────────────────
function setupManagementSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ── A列ラベルを配列で 1 回セット ──
  sheet.getRange('A1:A16').setValues([
    ['更新月'], [''], ['資産'], ['SBI元本'], ['楽天元本'], ['現金'], ['資産合計'],
    [''], ['負債'], ['ローン残高'], ['奨学金残高'], ['親借金残高'], ['負債合計'],
    [''], ['純資産'], ['純資産率'],
  ]).setHorizontalAlignment('right').setFontSize(11);

  // ── B列の数式を隣接ブロックごとにまとめてセット ──
  const lkp = col => `=IFERROR(LOOKUP(2,1/(入力!A$2:A<>""),入力!${col}$2:${col}),0)`;

  sheet.getRange('B1').setFormula(
    '=IFERROR(LOOKUP(2,1/(入力!A$2:A<>""),入力!A$2:A),"データなし")'
  );
  sheet.getRange('B4:B7').setFormulas([
    [lkp('B')], [lkp('C')], [lkp('D')], ['=SUM(B4:B6)'],
  ]);
  sheet.getRange('B10:B13').setFormulas([
    [lkp('E')], [lkp('F')], [lkp('G')], ['=SUM(B10:B12)'],
  ]);
  sheet.getRange('B15:B16').setFormulas([
    ['=B7-B13'], ['=IFERROR(B15/B7,0)'],
  ]);

  // ── 返済進捗エリアをまとめてセット ──
  sheet.getRange('C9:E9')
    .setValues([['当初借入額', '返済済み率', '進捗バー']])
    .setFontWeight('bold').setBackground('#f5f5f5').setHorizontalAlignment('center');

  sheet.getRange('D10:D12').setFormulas([
    ['=IFERROR(1-B10/C10,"—")'],
    ['=IFERROR(1-B11/C11,"—")'],
    ['=IFERROR(1-B12/C12,"—")'],
  ]);

  const bar = `{"charttype","bar";"max",1;"color1","#34a853";"color2","#eeeeee"}`;
  sheet.getRange('E10:E12').setFormulas([
    [`=IF(ISNUMBER(D10),SPARKLINE(D10,${bar}),"← C10 に当初借入額を入力")`],
    [`=IF(ISNUMBER(D11),SPARKLINE(D11,${bar}),"← C11 に当初借入額を入力")`],
    [`=IF(ISNUMBER(D12),SPARKLINE(D12,${bar}),"← C12 に当初借入額を入力")`],
  ]);

  // ── 書式：getRangeList で非連続範囲を 1 回で処理 ──
  sheet.getRangeList(['B4:B7','B10:B13','B15','C10:C12'])
    .setNumberFormat('¥#,##0');
  sheet.getRangeList(['B16','D10:D12'])
    .setNumberFormat('0.0%');
  sheet.getRange('B1').setNumberFormat('yyyy年mm月').setFontWeight('bold');

  // 太字
  sheet.getRangeList(['A1','A7:B7','A13:B13','A15:B16'])
    .setFontWeight('bold');

  // 背景色・文字色
  sheet.getRange('A3').setBackground('#e8f0fe').setFontColor('#1967d2').setFontWeight('bold');
  sheet.getRange('A9').setBackground('#fce8e6').setFontColor('#c5221f').setFontWeight('bold');
  sheet.getRangeList(['A7:B7']).setBackground('#c2d7f8');
  sheet.getRangeList(['A13:B13']).setBackground('#f4b8b5');
  sheet.getRangeList(['A15:B16']).setBackground('#e6f4ea');
  sheet.getRange('C10:C12').setBackground('#fff9c4');

  // ノートを配列で 1 回セット
  sheet.getRange('C10:C12').setNotes([
    ['ローンの当初借入額を入力\n例: 1500000'],
    ['奨学金の当初借入額を入力\n例: 800000'],
    ['親への借入の当初額を入力\n例: 300000'],
  ]);

  // 列幅
  sheet.setColumnWidth(1, 105);
  sheet.setColumnWidth(2, 115);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4,  90);
  sheet.setColumnWidth(5, 200);
}


// ─────────────────────────────────────────────────────────────
//  履歴シート
// ─────────────────────────────────────────────────────────────
function setupHistorySheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange('A1:K1').setValues([[
    '年月','SBI元本','楽天元本','現金','資産合計',
    'ローン残高','奨学金残高','親借金残高','負債合計','純資産','純資産率',
  ]]).setBackground('#1a73e8').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // 1 つの ARRAYFORMULA で全行・全列を自動展開
  const r = {
    date:'入力!A2:A', sbi:'入力!B2:B', raku:'入力!C2:C', cash:'入力!D2:D',
    loan:'入力!E2:E', gaku:'入力!F2:F', par: '入力!G2:G',
  };
  const asset    = `${r.sbi}+${r.raku}+${r.cash}`;
  const debt     = `${r.loan}+${r.gaku}+${r.par}`;
  const netAsset = `(${asset})-(${debt})`;
  const netRate  = `IFERROR((${netAsset})/(${asset}),"")`;

  sheet.getRange('A2').setFormula(
    `=ARRAYFORMULA(IF(${r.date}="","",` +
    `{${r.date},${r.sbi}+0,${r.raku}+0,${r.cash}+0,${asset},` +
    `${r.loan}+0,${r.gaku}+0,${r.par}+0,${debt},${netAsset},${netRate}}))`
  );

  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:J1000').setNumberFormat('#,##0');
  sheet.getRange('K2:K1000').setNumberFormat('0.0%');
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 10, 110);
  sheet.setFrozenRows(1);
}

/*
 * ─────────────────────────────────────────────────────────────
 *  グラフ作成手順（セットアップ後に手動で 1 回だけ）
 * ─────────────────────────────────────────────────────────────
 *  1.「履歴」シートを開く
 *  2. A列（年月）を選択 → Ctrl クリックで J列（純資産）も選択
 *  3. メニュー「挿入」→「グラフ」
 *  4. グラフの種類: 折れ線グラフ、X軸: 列 A（年月）
 *  5. 系列追加で E列（資産合計）・I列（負債合計）も追加可
 *  6. グラフ右上「⋮」→「グラフを移動」→「管理」シートへ
 * ─────────────────────────────────────────────────────────────
 */
