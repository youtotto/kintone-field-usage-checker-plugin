'use strict';

/** source/js/desktop.js を jsdom 上で読み込み、レコード詳細画面の DOM を模したヘルパー */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DESKTOP_JS = path.resolve(__dirname, '../../source/js/desktop.js');
const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} o
 * @param {Array<{code, label, type, hideLabel?}>} o.fields 詳細画面に並ぶフィールド（同名ラベル可）
 * @param {object} o.config プラグイン設定
 */
async function loadDetailScreen({
  fields = [
    { code: 'name_a', label: '顧客名', type: 'SINGLE_LINE_TEXT' },
    { code: 'name_b', label: '顧客名', type: 'SINGLE_LINE_TEXT' },
    { code: 'amount', label: '金額', type: 'NUMBER' },
    { code: 'items', label: 'テーブル', type: 'SUBTABLE' },
    { code: 'nolabel', label: '非表示ラベル', type: 'SINGLE_LINE_TEXT', hideLabel: true }
  ],
  config = { showFieldCode: 'true', notes: '{}' },
  getFormFieldsError = null
} = {}) {
  /* kintone 詳細画面の構造を模す: 行 > フィールド枠 (.control-gaia) > ラベル枠 / 値枠 */
  const controls = fields.map((f) => {
    const label = f.hideLabel ? '' : `<div class="control-label-gaia"><span class="control-label-text-gaia">${f.label}</span></div>`;
    return `<div class="control-gaia control-show-gaia" data-control="${f.code}">${label}<div class="control-value-gaia value-${f.type.toLowerCase()}-gaia" data-code="${f.code}"></div></div>`;
  }).join('');
  const dom = new JSDOM(`<!doctype html><html><body><div class="row-gaia">${controls}</div></body></html>`, {
    runScripts: 'outside-only',
    url: 'https://example.cybozu.com/k/5/show#record=1',
    virtualConsole: new VirtualConsole()
  });
  const { window } = dom;
  const logs = [];
  window.console.warn = (...a) => logs.push(a.map(String).join(' '));
  window.console.error = (...a) => logs.push(a.map(String).join(' '));

  const handlers = {};
  const properties = {};
  fields.forEach((f) => { properties[f.code] = { code: f.code, label: f.label, type: f.type }; });
  let getFormFieldsCalls = 0;

  window.kintone = {
    $PLUGIN_ID: 'mock-plugin',
    events: { on: (types, handler) => { [].concat(types).forEach((t) => { (handlers[t] = handlers[t] || []).push(handler); }); } },
    plugin: { app: { getConfig: () => JSON.parse(JSON.stringify(config)) } },
    app: {
      getId: () => 5,
      getFormFields: async () => {
        getFormFieldsCalls += 1;
        if (getFormFieldsError) throw getFormFieldsError;
        return JSON.parse(JSON.stringify(properties));
      },
      record: {
        /* API で要素を取得できるフィールドだけ返す（サブテーブルは null） */
        getFieldElement: (code) => {
          const f = properties[code];
          if (!f || f.type === 'SUBTABLE') return null;
          return window.document.querySelector(`.control-value-gaia[data-code="${code}"]`);
        }
      }
    }
  };

  window.eval(fs.readFileSync(DESKTOP_JS, 'utf8'));
  await wait(10);

  const doc = window.document;
  return {
    window, document: doc, logs, handlers,
    get getFormFieldsCalls() { return getFormFieldsCalls; },
    async fireDetailShow() {
      const event = { type: 'app.record.detail.show', record: {} };
      const results = (handlers['app.record.detail.show'] || []).map((h) => h(event));
      await Promise.all(results.map((r) => Promise.resolve(r).catch((e) => e)));
      await wait(30);
      return results;
    },
    tags: () => Array.from(doc.querySelectorAll('.fuc-field-code-tag')).map((t) => ({ code: t.dataset.fieldCode, text: t.textContent, control: t.closest('.control-gaia').dataset.control })),
    labelTextOf: (code) => { const c = doc.querySelector(`.control-gaia[data-control="${code}"] .control-label-text-gaia`); return c ? c.textContent : null; }
  };
}

module.exports = { loadDetailScreen, wait };
