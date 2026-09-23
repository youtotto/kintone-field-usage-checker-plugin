'use strict';

/** 詳細画面のフィールドコード表示（getFieldElement 基準） */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDetailScreen } = require('./helpers/load-desktop');

test('D-1 同名ラベルが複数あっても、それぞれのフィールドに正しいコードが付く', async () => {
  const screen = await loadDetailScreen();
  await screen.fireDetailShow();
  const tags = screen.tags();
  const byControl = Object.fromEntries(tags.map((t) => [t.control, t.code]));
  assert.equal(byControl.name_a, 'name_a');
  assert.equal(byControl.name_b, 'name_b');
  assert.equal(byControl.amount, 'amount');
  assert.equal(screen.labelTextOf('name_a'), '顧客名 [name_a]');
  assert.equal(screen.labelTextOf('name_b'), '顧客名 [name_b]');
});

test('D-2 再表示でもコードラベルを重複挿入しない。フィールド定義は 1 回だけ取得', async () => {
  const screen = await loadDetailScreen();
  await screen.fireDetailShow();
  await screen.fireDetailShow();
  await screen.fireDetailShow();
  const tags = screen.tags();
  assert.equal(tags.filter((t) => t.code === 'name_a').length, 1);
  assert.equal(tags.filter((t) => t.code === 'amount').length, 1);
  assert.equal(screen.getFormFieldsCalls, 1);
});

test('D-3 API で要素を取得できない対象（サブテーブル）とラベルの無いフィールドは対象外', async () => {
  const screen = await loadDetailScreen();
  await screen.fireDetailShow();
  const codes = screen.tags().map((t) => t.code);
  assert.ok(!codes.includes('items'));
  assert.ok(!codes.includes('nolabel'), 'ラベル枠が無いフィールドに別フィールドのラベルを借りない');
  assert.deepEqual(codes.sort(), ['amount', 'name_a', 'name_b']);
});

test('D-4 設定がオフなら何もしない（イベント登録もしない）', async () => {
  const screen = await loadDetailScreen({ config: { showFieldCode: 'false' } });
  assert.deepEqual(Object.keys(screen.handlers), []);
});

test('D-5 イベントハンドラは event を同期的に返し、getFormFields 失敗時は警告だけで画面を壊さない', async () => {
  const screen = await loadDetailScreen({ getFormFieldsError: new Error('network') });
  const results = await screen.fireDetailShow();
  assert.equal(results.length, 1);
  assert.equal(results[0].type, 'app.record.detail.show', 'Promise ではなく event を返す');
  assert.equal(screen.tags().length, 0);
  assert.ok(screen.logs.some((l) => /フィールドコードの表示に失敗/.test(l)));
});

test('D-6 ラベル文字列一致・内部クラス依存のロジックが残っていない', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '../source/js/desktop.js'), 'utf8');
  assert.match(src, /getFieldElement/);
  assert.doesNotMatch(src, /querySelectorAll\('\.control-label-text-gaia'\)/);
  assert.doesNotMatch(src, /labelText === field\.label/);
  assert.doesNotMatch(src, /window\._fieldCodeLabelCache/);
  assert.doesNotMatch(src, /licenseChecker|checkLicense/);
});
