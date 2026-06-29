/**
 * 資産・負債 自動管理システム セットアップスクリプト
 *
 * 使い方:
 *   1. Googleスプレッドシートを新規作成
 *   2. メニュー「拡張機能」→「Apps Script」を開く
 *   3. このファイルの内容を全選択して貼り付け
 *   4. 上部の関数リストから「setupAssetManagementSystem」を選び「実行」
 *   5. アクセス許可を承認する（初回のみ）
 *   6. 完了ダイアログが表示されたらスプレッドシートに戻る
 *
 * セットアップ後の手順:
 *   1.「管理」シートの C10:C12 に当初借入額を手入力
 *   2.「入力」シートの 2行目から毎月のデータを入力
 *   3.「履歴」シートのデータをもとにグラフを作成（手順は下記コメント参照）
 */

function setupAssetManagementSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存シートがあれば取得、なければ新規作成
  const inputSheet     = ss.getSheetByName('入力')  || ss.insertSheet('入力');
  const managementSheet = ss.getSheetByName('管理') || ss.insertSheet('管理');
  const historySheet   = ss.getSheetByName('履歴')  || ss.insertSheet('履歴');

  setupInputSheet(inputSheet);
  setupManagementSheet(managementSheet);
  setupHistorySheet(historySheet);

  // デフォルトの「シート1」が残っていたら削除
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了！\n\n' +
    '次の手順:\n' +
    '①「管理」シートの C10・C11・C12 に当初借入額を入力\n' +
    '②「入力」シートの 2行目から毎月のデータを入力\n' +
    '③「履歴」シートをもとにグラフを挿入'
  );
}

// ─── 入力シート ───────────────────────────────────────────────

function setupInputSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ヘッダー
  const headers = [['年月', 'SBI元本', '楽天元本', '現金', 'ローン残高', '奨学金残高', '親借金残高']];
  sheet.getRange('A1:G1').setValues(headers)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // 入力例（2行目）
  const today = new Date();
  const sample = [[today, 500000, 300000, 100000, 1500000, 800000, 300000]];
  sheet.getRange('A2:G2').setValues(sample);

  // 書式
  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:G1000').setNumberFormat('#,##0');

  // 列幅
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 6, 115);

  sheet.setFrozenRows(1);
}

// ─── 管理シート ───────────────────────────────────────────────

function setupManagementSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ─ ラベル列 (A) ─
  const labels = [
    ['更新月'],        // 1
    [''],              // 2
    ['▼ 資産'],       // 3
    ['SBI元本'],       // 4
    ['楽天元本'],      // 5
    ['現金'],          // 6
    ['資産合計'],      // 7
    [''],              // 8
    ['▼ 負債'],       // 9
    ['ローン残高'],    // 10
    ['奨学金残高'],    // 11
    ['親借金残高'],    // 12
    ['負債合計'],      // 13
    [''],              // 14
    ['純資産'],        // 15
    ['純資産率'],      // 16
  ];
  sheet.getRange('A1:A16').setValues(labels);

  // ─ 現在値 (B列) ─
  sheet.getRange('B1').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!A2:A),"データなし")');
  sheet.getRange('B4').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!B2:B),0)');
  sheet.getRange('B5').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!C2:C),0)');
  sheet.getRange('B6').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!D2:D),0)');
  sheet.getRange('B7').setFormula('=SUM(B4:B6)');
  sheet.getRange('B10').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!E2:E),0)');
  sheet.getRange('B11').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!F2:F),0)');
  sheet.getRange('B12').setFormula('=IFERROR(LOOKUP(2,1/(入力!A2:A<>""),入力!G2:G),0)');
  sheet.getRange('B13').setFormula('=SUM(B10:B12)');
  sheet.getRange('B15').setFormula('=B7-B13');
  sheet.getRange('B16').setFormula('=IFERROR(B15/B7,0)');

  // ─ 当初借入額ヘッダー (C9) ─
  sheet.getRange('C9').setValue('当初借入額');
  sheet.getRange('D9').setValue('返済済み率');
  sheet.getRange('E9').setValue('進捗バー');

  // ─ 当初借入額 (C列) ─ 手入力セルであることをノートで案内
  sheet.getRange('C10').setNote('当初のローン借入額を入力（例: 1500000）');
  sheet.getRange('C11').setNote('当初の奨学金借入額を入力（例: 800000）');
  sheet.getRange('C12').setNote('当初の親への借入額を入力（例: 300000）');

  // ─ 返済済み率 (D列) ─
  sheet.getRange('D10').setFormula('=IFERROR(1-B10/C10,"—")');
  sheet.getRange('D11').setFormula('=IFERROR(1-B11/C11,"—")');
  sheet.getRange('D12').setFormula('=IFERROR(1-B12/C12,"—")');

  // ─ 進捗バー (E列・SPARKLINE) ─
  const sparklineFormula = (cell) =>
    `=IFERROR(SPARKLINE(${cell},{"charttype","bar";"max",1;"color1","#34a853";"color2","#eeeeee"}),"")`;
  sheet.getRange('E10').setFormula(sparklineFormula('D10'));
  sheet.getRange('E11').setFormula(sparklineFormula('D11'));
  sheet.getRange('E12').setFormula(sparklineFormula('D12'));

  // ─ 書式設定 ─
  sheet.getRange('A1').setFontWeight('bold');
  sheet.getRange('B1').setNumberFormat('yyyy年mm月').setFontWeight('bold');

  // 資産セクション
  sheet.getRange('A3').setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange('B4:B6').setNumberFormat('¥#,##0');
  sheet.getRange('B7').setNumberFormat('¥#,##0').setFontWeight('bold').setBackground('#c2d7f8');

  // 負債セクション
  sheet.getRange('A9').setFontWeight('bold').setBackground('#fce8e6');
  sheet.getRange('B10:B12').setNumberFormat('¥#,##0');
  sheet.getRange('C10:C12').setNumberFormat('¥#,##0').setBackground('#fff8e1');
  sheet.getRange('D10:D12').setNumberFormat('0.0%');
  sheet.getRange('B13').setNumberFormat('¥#,##0').setFontWeight('bold').setBackground('#f4b8b5');

  // サマリー
  sheet.getRange('B15').setNumberFormat('¥#,##0').setFontWeight('bold').setBackground('#e6f4ea');
  sheet.getRange('B16').setNumberFormat('0.0%').setFontWeight('bold').setBackground('#e6f4ea');

  // ヘッダー行（C9:E9）
  sheet.getRange('C9:E9').setFontWeight('bold').setBackground('#f5f5f5').setHorizontalAlignment('center');

  // 列幅
  sheet.setColumnWidth(1, 105);
  sheet.setColumnWidth(2, 115);
  sheet.setColumnWidth(3, 115);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 160);

  // A列の文字を右揃え
  sheet.getRange('A1:A16').setHorizontalAlignment('right');
}

// ─── 履歴シート ──────────────────────────────────────────────

function setupHistorySheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ヘッダー
  const headers = [['年月','SBI元本','楽天元本','現金','資産合計','ローン残高','奨学金残高','親借金残高','負債合計','純資産','純資産率']];
  sheet.getRange('A1:K1').setValues(headers)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // ARRAYFORMULA（1式で全履歴を自動展開）
  const formula =
    '=ARRAYFORMULA(' +
    'IF(入力!A2:A="","",' +
    '{入力!A2:A,' +
    'IF(入力!B2:B="",0,入力!B2:B),' +
    'IF(入力!C2:C="",0,入力!C2:C),' +
    'IF(入力!D2:D="",0,入力!D2:D),' +
    'IF(入力!B2:B="",0,入力!B2:B)+IF(入力!C2:C="",0,入力!C2:C)+IF(入力!D2:D="",0,入力!D2:D),' +
    'IF(入力!E2:E="",0,入力!E2:E),' +
    'IF(入力!F2:F="",0,入力!F2:F),' +
    'IF(入力!G2:G="",0,入力!G2:G),' +
    'IF(入力!E2:E="",0,入力!E2:E)+IF(入力!F2:F="",0,入力!F2:F)+IF(入力!G2:G="",0,入力!G2:G),' +
    '(IF(入力!B2:B="",0,入力!B2:B)+IF(入力!C2:C="",0,入力!C2:C)+IF(入力!D2:D="",0,入力!D2:D))' +
    '-(IF(入力!E2:E="",0,入力!E2:E)+IF(入力!F2:F="",0,入力!F2:F)+IF(入力!G2:G="",0,入力!G2:G)),' +
    'IFERROR(' +
    '((IF(入力!B2:B="",0,入力!B2:B)+IF(入力!C2:C="",0,入力!C2:C)+IF(入力!D2:D="",0,入力!D2:D))' +
    '-(IF(入力!E2:E="",0,入力!E2:E)+IF(入力!F2:F="",0,入力!F2:F)+IF(入力!G2:G="",0,入力!G2:G)))' +
    '/(IF(入力!B2:B="",0,入力!B2:B)+IF(入力!C2:C="",0,入力!C2:C)+IF(入力!D2:D="",0,入力!D2:D)),"")}' +
    '))';

  sheet.getRange('A2').setFormula(formula);

  // 書式
  sheet.getRange('A2:A1000').setNumberFormat('yyyy年mm月');
  sheet.getRange('B2:J1000').setNumberFormat('#,##0');
  sheet.getRange('K2:K1000').setNumberFormat('0.0%');

  // 列幅
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, 10, 110);

  sheet.setFrozenRows(1);
}

/**
 * グラフ作成手順（手動）:
 *
 * 1.「履歴」シートで A1:A と J1:J を Ctrl クリックで複数選択
 * 2. メニュー「挿入」→「グラフ」
 * 3. グラフエディタ:
 *    - グラフの種類: 折れ線グラフ
 *    - X 軸: 年月（列 A）
 *    - 系列: 純資産（列 J）
 *    - 追加したい場合:「+ 系列を追加」で 資産合計(E列)・負債合計(I列) も追加可能
 * 4.「グラフを移動」で「管理」シートに配置すると見やすい
 */
