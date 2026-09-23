(function () {
  'use strict';

  /*
   * フィールド使用状況チェッカー（レコード詳細画面）
   * 設定でオンのとき、フィールドラベルの横に [フィールドコード] を表示する。
   *   - 対象要素は kintone.app.record.getFieldElement(code) を基準に特定する（ラベル文字列では照合しない）
   *   - サブテーブル内のフィールドやグループなど、API で要素を取得できないものは対象外
   *   - 再表示時は既存のタグを再利用し、重複挿入しない
   */

  const config = kintone.plugin.app.getConfig(kintone.$PLUGIN_ID);
  if (!config || config.showFieldCode !== 'true') return;

  const TAG_CLASS = 'fuc-field-code-tag';
  const SKIP_TYPES = new Set(['SUBTABLE', 'GROUP', 'REFERENCE_TABLE', 'SPACER', 'LABEL', 'HR']);

  let fieldsPromise = null;
  function getFields() {
    if (!fieldsPromise) {
      fieldsPromise = kintone.app.getFormFields().catch((e) => {
        fieldsPromise = null;
        throw e;
      });
    }
    return fieldsPromise;
  }

  /**
   * 値の要素（getFieldElement の戻り）から、そのフィールド自身のラベル要素を探す。
   * 祖先を 2 段までさかのぼり、直下の子にラベル要素（class に control-label を含む）を持つ枠を
   * そのフィールドの枠とみなす。別フィールドのラベルを拾わないよう、子孫全体からは探さない。
   */
  function findLabelElement(valueEl) {
    let node = valueEl;
    for (let depth = 0; depth < 2 && node && node.parentElement; depth += 1) {
      node = node.parentElement;
      const labelBox = Array.from(node.children).find((child) => child !== valueEl && /control-label/.test(child.className || ''));
      if (labelBox) {
        return labelBox.querySelector('[class*="control-label-text"]') || labelBox;
      }
    }
    return null;
  }

  function injectFieldCodes(fieldMap) {
    Object.keys(fieldMap || {}).forEach((code) => {
      const field = fieldMap[code];
      if (!field || SKIP_TYPES.has(field.type)) return;

      let valueEl = null;
      try {
        valueEl = kintone.app.record.getFieldElement(code);
      } catch (_e) {
        valueEl = null;
      }
      if (!valueEl) return;

      const labelEl = findLabelElement(valueEl);
      if (!labelEl) return;
      if (labelEl.querySelector(`.${TAG_CLASS}`)) return;

      const tag = document.createElement('span');
      tag.className = TAG_CLASS;
      tag.dataset.fieldCode = code;
      tag.textContent = ` [${code}]`;
      tag.style.cssText = 'font-size:11px;color:#888;margin-left:4px;font-weight:normal;';
      labelEl.appendChild(tag);
    });
  }

  kintone.events.on('app.record.detail.show', (event) => {
    getFields()
      .then(injectFieldCodes)
      .catch((e) => console.warn('フィールド使用状況チェッカー: フィールドコードの表示に失敗しました', e));
    return event;
  });
})();
