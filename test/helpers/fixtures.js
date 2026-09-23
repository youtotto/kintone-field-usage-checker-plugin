'use strict';

/** テスト用のアプリ設定フィクスチャ（アプリ ID 5、関連先アプリ ID 30） */

const APP_ID = 5;
const RELATED_APP_ID = 30;

function field(code, type, extra = {}) {
  return { code, label: extra.label || `${code}ラベル`, type, ...extra };
}

/** フォーム定義（getFormFields の戻り: code → property） */
function formProperties() {
  return {
    date: field('date', 'DATE'),
    update_date: field('update_date', 'DATE'),
    A: field('A', 'SINGLE_LINE_TEXT'),
    ABC: field('ABC', 'SINGLE_LINE_TEXT'),
    price: field('price', 'NUMBER'),
    qty: field('qty', 'NUMBER'),
    total: field('total', 'CALC', { expression: 'price * qty' }),
    rank: field('rank', 'CALC', { expression: 'IF(total > 10000, "A", "B")' }),
    memo: field('memo', 'MULTI_LINE_TEXT'),
    status_text: field('status_text', 'SINGLE_LINE_TEXT', { expression: 'DATE_FORMAT(date, "YYYY", "Asia/Tokyo")' }),
    customer_code: field('customer_code', 'SINGLE_LINE_TEXT', {
      lookup: {
        relatedApp: { app: String(RELATED_APP_ID), code: '' },
        relatedKeyField: 'cust_id',
        fieldMappings: [{ field: 'customer_name', relatedField: 'cust_name' }],
        lookupPickerFields: ['cust_id', 'cust_name'],
        filterCond: 'cust_active = "1"',
        sort: 'cust_id asc'
      }
    }),
    customer_name: field('customer_name', 'SINGLE_LINE_TEXT'),
    owner: field('owner', 'USER_SELECT'),
    approver: field('approver', 'USER_SELECT'),
    notify_target: field('notify_target', 'USER_SELECT'),
    remind_target: field('remind_target', 'USER_SELECT'),
    acl_user: field('acl_user', 'USER_SELECT'),
    secret: field('secret', 'SINGLE_LINE_TEXT'),
    only_notify: field('only_notify', 'DROP_DOWN'),
    only_process: field('only_process', 'DROP_DOWN'),
    only_report: field('only_report', 'DROP_DOWN'),
    only_action: field('only_action', 'DROP_DOWN'),
    only_view_cond: field('only_view_cond', 'DROP_DOWN'),
    only_view_sort: field('only_view_sort', 'DATE'),
    cal_date: field('cal_date', 'DATE'),
    cal_title: field('cal_title', 'SINGLE_LINE_TEXT'),
    recacl_cond: field('recacl_cond', 'DROP_DOWN'),
    unused1: field('unused1', 'SINGLE_LINE_TEXT'),
    unused2: field('unused2', 'NUMBER'),
    ref_key: field('ref_key', 'SINGLE_LINE_TEXT'),
    related: field('related', 'REFERENCE_TABLE', {
      referenceTable: {
        relatedApp: { app: String(RELATED_APP_ID), code: '' },
        condition: { field: 'ref_key', relatedField: 'parent_key' },
        filterCond: 'amount > 0',
        displayFields: ['amount', 'date', 'note'],
        sort: 'amount desc',
        size: '5'
      }
    }),
    items: field('items', 'SUBTABLE', {
      fields: {
        item_name: field('item_name', 'SINGLE_LINE_TEXT'),
        item_price: field('item_price', 'NUMBER'),
        item_qty: field('item_qty', 'NUMBER'),
        item_total: field('item_total', 'CALC', { expression: 'item_price * item_qty' })
      }
    }),
    レコード番号: field('レコード番号', 'RECORD_NUMBER'),
    作成者: field('作成者', 'CREATOR', { label: '作成者' }),
    更新者: field('更新者', 'MODIFIER', { label: '更新者' }),
    ステータス: field('ステータス', 'STATUS'),
    作業者: field('作業者', 'STATUS_ASSIGNEE', { label: '作業者' })
  };
}

/** フォームレイアウト（getFormLayout の戻り: layout 配列） */
function formLayout() {
  const row = (...codes) => ({ type: 'ROW', fields: codes.map((c) => ({ type: 'X', code: c })) });
  return [
    row('date', 'update_date'),
    row('A', 'ABC'),
    { type: 'GROUP', code: 'grp', layout: [row('price', 'qty', 'total'), row('rank')] },
    row('memo', 'status_text'),
    row('customer_code', 'customer_name'),
    row('owner', 'approver', 'notify_target', 'remind_target', 'acl_user'),
    row('secret', 'only_notify', 'only_process', 'only_report', 'only_action', 'only_view_cond', 'only_view_sort'),
    row('cal_date', 'cal_title', 'recacl_cond'),
    row('unused1', 'unused2'),
    { type: 'ROW', fields: [{ type: 'LABEL', label: 'ラベル' }, { type: 'SPACER', elementId: 'sp' }] },
    row('ref_key'),
    { type: 'SUBTABLE', code: 'items', fields: [{ type: 'X', code: 'item_name' }, { type: 'X', code: 'item_price' }, { type: 'X', code: 'item_qty' }, { type: 'X', code: 'item_total' }] },
    row('related'),
    row('レコード番号', '作成者')
  ];
}

/** 関連先アプリ（ID 30）のフィールド定義 */
function relatedAppProperties() {
  return {
    properties: {
      parent_key: field('parent_key', 'SINGLE_LINE_TEXT', { label: '親キー' }),
      amount: field('amount', 'NUMBER', { label: '金額' }),
      date: field('date', 'DATE', { label: '関連先の日付' }),
      note: field('note', 'MULTI_LINE_TEXT', { label: '備考' }),
      cust_id: field('cust_id', 'SINGLE_LINE_TEXT', { label: '顧客ID' }),
      cust_name: field('cust_name', 'SINGLE_LINE_TEXT', { label: '顧客名' })
    }
  };
}

function settings() {
  return {
    views: {
      views: {
        顧客一覧: { type: 'LIST', name: '顧客一覧', fields: ['A', 'customer_name', 'owner'], filterCond: 'only_view_cond in ("x") and update_date > TODAY()', sort: 'only_view_sort desc' },
        カレンダー: { type: 'CALENDAR', name: 'カレンダー', date: 'cal_date', title: 'cal_title', filterCond: '', sort: '' },
        カスタム: { type: 'CUSTOM', name: 'カスタム', html: '<div>record.unused1.value</div>', filterCond: '', sort: '' }
      }
    },
    general: {
      notifyToCommenter: true,
      notifications: [
        { entity: { type: 'FIELD_ENTITY', code: '更新者' }, includeSubs: false, recordAdded: false, recordEdited: false, commentAdded: true, statusChanged: false, fileImported: false },
        { entity: { type: 'FIELD_ENTITY', code: '作成者' }, includeSubs: false, recordAdded: false, recordEdited: true, commentAdded: true, statusChanged: true, fileImported: false },
        { entity: { type: 'FIELD_ENTITY', code: '作業者' }, includeSubs: false, recordAdded: false, recordEdited: false, commentAdded: false, statusChanged: true, fileImported: false },
        { entity: { type: 'USER', code: 'user1' }, includeSubs: false, recordAdded: true, recordEdited: true, commentAdded: true, statusChanged: true, fileImported: true },
        { entity: { type: 'ORGANIZATION', code: 'org1' }, includeSubs: true, recordAdded: true, recordEdited: false, commentAdded: false, statusChanged: false, fileImported: false },
        { entity: { type: 'GROUP', code: 'grp1' }, includeSubs: false, recordAdded: false, recordEdited: false, commentAdded: true, statusChanged: false, fileImported: false }
      ]
    },
    perRecord: {
      notifications: [
        { title: '契約期限通知', filterCond: 'only_notify = "1" and date <= TODAY()', targets: [{ entity: { type: 'FIELD_ENTITY', code: 'notify_target' } }, { entity: { type: 'USER', code: 'u1' } }] }
      ]
    },
    reminder: {
      notifications: [
        { title: '前日リマインド', timing: { code: 'update_date', daysLater: '-1', time: '09:00' }, filterCond: 'ABC = "x"', targets: [{ entity: { type: 'FIELD_ENTITY', code: 'remind_target' } }] }
      ]
    },
    status: {
      enable: true,
      states: {
        未処理: { name: '未処理', index: '0', assignee: { type: 'ONE', entities: [{ entity: { type: 'FIELD_ENTITY', code: 'approver' } }] } },
        完了: { name: '完了', index: '1', assignee: { type: 'ONE', entities: [] } }
      },
      actions: [
        { name: '申請', from: '未処理', to: '完了', filterCond: 'only_process = "済" and price > 0' }
      ]
    },
    reports: {
      reports: {
        月別売上: { chartType: 'BAR', name: '月別売上', groups: [{ code: 'date', per: 'MONTH' }], aggregations: [{ type: 'SUM', code: 'price' }], filterCond: 'only_report = "有"', sorts: [{ by: 'TOTAL', order: 'DESC' }, { by: 'qty', order: 'ASC' }] }
      }
    },
    actions: {
      actions: {
        転記: { name: '転記', destApp: { app: '99' }, mappings: [{ srcType: 'FIELD', srcField: 'memo', destField: 'memo2' }, { srcType: 'RECORD_URL', destField: 'url' }], filterCond: 'only_action = "OK"' }
      }
    },
    recordAcl: {
      rights: [
        { filterCond: 'recacl_cond = "非公開"', entities: [{ entity: { type: 'FIELD_ENTITY', code: 'acl_user' }, viewable: true }] }
      ]
    },
    fieldAcl: {
      rights: [
        { code: 'secret', entities: [{ entity: { type: 'GROUP', code: 'everyone' }, accessibility: 'NONE' }] }
      ]
    }
  };
}

module.exports = { APP_ID, RELATED_APP_ID, field, formProperties, formLayout, relatedAppProperties, settings };
