'use strict';

/** 条件式のトークン抽出（識別子境界・文字列リテラル・関数名の扱い） */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfigScreen } = require('./helpers/load-config');

let fn;
test.before(async () => {
  const screen = await loadConfigScreen();
  fn = screen.internal.extractCondTokens;
});

const codes = ['date', 'update_date', 'A', 'ABC', 'price', 'IF', 'TODAY', 'ステータス', '売上_合計', '$id'];

test('C-1 date と update_date を区別する', () => {
  assert.deepEqual(fn('update_date > TODAY()', codes), ['update_date']);
  assert.deepEqual(fn('date > TODAY()', codes), ['date']);
  assert.deepEqual(fn('date = "2026-01-01" and update_date <= NOW()', codes), ['date', 'update_date']);
});

test('C-2 A と ABC を区別する', () => {
  assert.deepEqual(fn('ABC = "x"', codes), ['ABC']);
  assert.deepEqual(fn('A = "x"', codes), ['A']);
  assert.deepEqual(fn('A in ("1") and ABC like "2"', codes), ['A', 'ABC']);
});

test('C-3 文字列リテラル内の偶然一致は参照にしない（エスケープ付きも）', () => {
  assert.deepEqual(fn('price = "date"', codes), ['price']);
  assert.deepEqual(fn('ABC = "say \\"date\\" now"', codes), ['ABC']);
  assert.deepEqual(fn('ABC in ("A", "price")', codes), ['ABC']);
});

test('C-4 関数名は参照にしない（IF( / TODAY( ）、計算式のフィールドは拾う', () => {
  assert.deepEqual(fn('IF(price > 10000, "A", "B")', codes), ['price']);
  assert.deepEqual(fn('date >= TODAY()', codes), ['date']);
  assert.deepEqual(fn('IF (price > 0, 1, 0)', codes), ['price']);
});

test('C-5 日本語・記号を含むコード、order by / 並び替え文字列', () => {
  assert.deepEqual(fn('ステータス in ("完了") order by 売上_合計 desc', codes), ['ステータス', '売上_合計']);
  assert.deepEqual(fn('売上_合計 desc, date asc', codes), ['date', '売上_合計']);
  assert.deepEqual(fn('ステータス2 = "x"', codes), [], '「ステータス2」は「ステータス」ではない');
  assert.deepEqual(fn('$id > 100', codes), ['$id']);
});

test('C-6 空・非文字列は空配列', () => {
  assert.deepEqual(fn('', codes), []);
  assert.deepEqual(fn(null, codes), []);
  assert.deepEqual(fn(undefined, codes), []);
  assert.deepEqual(fn(123, codes), []);
});
