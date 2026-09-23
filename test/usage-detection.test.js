'use strict';

/** 使用箇所の判定（フォーム内の全フィールドコードを起点に、各設定から検出する） */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfigScreen } = require('./helpers/load-config');
const fx = require('./helpers/fixtures');

let internal;
let usage;
test.before(async () => {
  const screen = await loadConfigScreen();
  internal = screen.internal;
  usage = internal.extractUsage({ appId: fx.APP_ID, properties: fx.formProperties(), ...fx.settings() });
});

const kinds = (code) => (usage[code] || []).map((u) => u.kind);
const names = (code) => (usage[code] || []).map((u) => `${u.kind}:${u.name}`);

test('U-1 全フィールドコードが判定対象（サブテーブル内・レイアウト外のシステムフィールドを含む）', () => {
  const codes = internal.collectFieldCodes(fx.formProperties());
  ['date', 'items', 'item_name', 'item_total', 'ステータス', '作業者', 'unused1'].forEach((c) => assert.ok(codes.has(c), c));
  assert.ok(!codes.has('amount'), '関連先アプリのフィールドは含まない');
  Object.keys(fx.formProperties()).forEach((c) => assert.ok(c in usage, `usage に ${c}`));
  assert.ok('item_price' in usage);
});

test('U-2 一覧に出ていないフィールドでも通知 / プロセス / グラフ / アクション条件から検出される', () => {
  assert.deepEqual(names('only_notify'), ['notify:契約期限通知']);
  assert.deepEqual(names('only_process'), ['process:アクション「申請」']);
  assert.deepEqual(names('only_report'), ['report:月別売上']);
  assert.deepEqual(names('only_action'), ['action:転記']);
});

test('U-3 date と update_date、A と ABC を誤検出しない', () => {
  /* date: 通知条件 / グラフのグループ / 関連先の displayFields（他アプリ側 → 数えない） */
  assert.deepEqual(names('date').sort(), ['calc:status_textラベル', 'notify:契約期限通知', 'report:月別売上']);
  /* update_date: 一覧の絞り込み / リマインダー timing */
  assert.deepEqual(names('update_date').sort(), ['reminder:前日リマインド', 'view:顧客一覧']);
  /* A: 一覧の表示列だけ。ABC: リマインダー条件だけ */
  assert.deepEqual(names('A'), ['view:顧客一覧']);
  assert.deepEqual(names('ABC'), ['reminder:前日リマインド']);
});

test('U-4 文字列リテラル内の偶然一致を除外（計算式 IF の "A" / "B" は A の参照ではない）', () => {
  assert.ok(!names('A').some((n) => n.startsWith('calc:')), names('A').join(','));
});

test('U-5 計算式: 四則演算と IF 式、文字列 1 行の自動計算、サブテーブル内の計算式', () => {
  assert.deepEqual(names('price').filter((n) => n.startsWith('calc:')), ['calc:totalラベル']);
  assert.deepEqual(names('qty').filter((n) => n.startsWith('calc:')), ['calc:totalラベル']);
  assert.deepEqual(names('total'), ['calc:rankラベル'], 'IF(total > …) から検出');
  assert.deepEqual(names('date').filter((n) => n.startsWith('calc:')), ['calc:status_textラベル'], 'SINGLE_LINE_TEXT の expression');
  assert.deepEqual(names('item_price'), ['calc:item_totalラベル']);
  assert.deepEqual(names('item_qty'), ['calc:item_totalラベル']);
});

test('U-6 ルックアップ: フィールド自身とコピー先を検出、他アプリ側の relatedKeyField / filterCond は数えない', () => {
  assert.deepEqual(names('customer_code'), ['lookup:customer_codeラベル']);
  assert.deepEqual(names('customer_name').filter((n) => n.startsWith('lookup:')), ['lookup:customer_codeラベル']);
  assert.ok(!('cust_id' in usage) && !('cust_active' in usage), '関連先アプリのコードは usage に現れない');
});

test('U-6b 自アプリ自身を参照するルックアップは参照先側のフィールドも自アプリの使用箇所になる', () => {
  const props = fx.formProperties();
  props.customer_code.lookup.relatedApp = { app: String(fx.APP_ID) };
  props.customer_code.lookup.relatedKeyField = 'unused1';
  props.customer_code.lookup.filterCond = 'unused2 > 0';
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: props });
  assert.deepEqual(u.unused1.map((x) => x.kind), ['lookup']);
  assert.deepEqual(u.unused2.map((x) => x.kind), ['lookup']);
});

test('U-7 関連レコード一覧: condition.field（自アプリ側）を検出し、他アプリ側の relatedField / displayFields / filterCond / sort は数えない', () => {
  assert.deepEqual(names('ref_key'), ['ref:relatedラベル']);
  assert.ok(!('parent_key' in usage) && !('amount' in usage) && !('note' in usage));
  /* displayFields に自アプリと同名の date があっても、自アプリの date の使用箇所にはならない */
  assert.ok(!names('date').some((n) => n.startsWith('ref:')));
});

test('U-7b 自アプリ自身を参照する関連レコード一覧は filterCond / sort / displayFields も自アプリの使用箇所になる', () => {
  const props = fx.formProperties();
  props.related.referenceTable.relatedApp = { app: String(fx.APP_ID) };
  props.related.referenceTable.condition = { field: 'ref_key', relatedField: 'unused1' };
  props.related.referenceTable.filterCond = 'unused2 > 0';
  props.related.referenceTable.sort = 'memo asc';
  props.related.referenceTable.displayFields = ['A'];
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: props });
  ['ref_key', 'unused1', 'unused2', 'memo', 'A'].forEach((c) => assert.deepEqual(u[c].map((x) => x.kind), ['ref'], c));
});

test('U-7c referenceTable が null（参照先アプリの閲覧権限なし）でも判定が落ちない', () => {
  const props = fx.formProperties();
  props.related.referenceTable = null;
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: props, ...fx.settings() });
  assert.deepEqual(u.ref_key, []);
  assert.ok(u.only_notify.length === 1);
});

test('U-8 一覧: 表示列・filterCond・sort、カレンダーの date / title、カスタムビュー HTML は対象外', () => {
  assert.deepEqual(names('customer_name').filter((n) => n.startsWith('view:')), ['view:顧客一覧']);
  assert.deepEqual(names('only_view_cond'), ['view:顧客一覧'], 'filterCond');
  assert.deepEqual(names('only_view_sort'), ['view:顧客一覧'], 'sort');
  assert.deepEqual(names('cal_date'), ['view:カレンダー']);
  assert.deepEqual(names('cal_title'), ['view:カレンダー']);
  assert.deepEqual(names('unused1'), [], 'カスタムビューの HTML 内の record.unused1.value は対象外');
});

test('U-9 通知: filterCond と通知先 FIELD_ENTITY。リマインダー: timing.code / filterCond / 通知先', () => {
  assert.deepEqual(names('notify_target'), ['notify:契約期限通知']);
  assert.deepEqual(names('remind_target'), ['reminder:前日リマインド']);
  assert.deepEqual(names('update_date').filter((n) => n.startsWith('reminder:')), ['reminder:前日リマインド']);
});

test('U-10 プロセス管理: アクション条件と作業者 FIELD_ENTITY。action 全体の文字列一致はしない', () => {
  assert.deepEqual(names('approver'), ['process:ステータス「未処理」の作業者']);
  assert.deepEqual(names('price').filter((n) => n.startsWith('process:')), ['process:アクション「申請」']);
  /* アクション名「申請」やステータス名にコードが含まれても使用扱いにならない */
  const props = fx.formProperties();
  props['申請'] = { code: '申請', label: '申請', type: 'SINGLE_LINE_TEXT' };
  props['未処理'] = { code: '未処理', label: '未処理', type: 'SINGLE_LINE_TEXT' };
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: props, status: fx.settings().status });
  assert.deepEqual(u['申請'], []);
  assert.deepEqual(u['未処理'], []);
});

test('U-11 グラフ: groups / aggregations / sorts.by / filterCond（TOTAL などの仮想キーは無視）', () => {
  assert.ok(names('date').includes('report:月別売上'), 'groups');
  assert.ok(names('price').includes('report:月別売上'), 'aggregations');
  assert.deepEqual(names('qty').filter((n) => n.startsWith('report:')), ['report:月別売上'], 'sorts.by');
  assert.ok(!('TOTAL' in usage));
});

test('U-12 アプリアクション: mappings.srcField（FIELD のみ）と filterCond', () => {
  assert.deepEqual(names('memo'), ['action:転記']);
  assert.ok(!('url' in usage) && !('memo2' in usage), '転記先のフィールドは数えない');
});

test('U-13 アクセス権: レコード ACL の filterCond と FIELD_ENTITY、フィールド ACL の code', () => {
  assert.deepEqual(names('recacl_cond'), ['acl:レコードのアクセス権']);
  assert.deepEqual(names('acl_user'), ['acl:レコードのアクセス権']);
  assert.deepEqual(names('secret'), ['acl:フィールドのアクセス権']);
});

test('U-14 どこにも出ないフィールドは空配列（未検出）。同じ種類・同じ名前は 1 回だけ', () => {
  assert.deepEqual(usage.unused1, []);
  assert.deepEqual(usage.unused2, []);
  assert.deepEqual(usage.item_name, []);
  const set = fx.settings();
  set.views.views.顧客一覧.filterCond = 'A = "1" and A = "2"';
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: fx.formProperties(), ...set });
  assert.equal(u.A.filter((x) => x.kind === 'view').length, 1);
});

test('U-15 設定が取得できない（null）ものがあっても他の判定は行う', () => {
  const u = internal.extractUsage({ appId: fx.APP_ID, properties: fx.formProperties(), views: null, status: null, reports: fx.settings().reports });
  assert.deepEqual(u.only_report.map((x) => x.kind), ['report']);
  assert.deepEqual(u.only_view_cond, []);
});
