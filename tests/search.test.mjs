import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SITES, normalizeKeyword, buildUrl, nextSite } = require("../search.js");

test("サイトはアプリと同じ9件・同じ順", () => {
  assert.deepEqual(SITES.map((s) => s.id),
    ["amazon", "rakuten", "yodobashi", "yahoo", "mercari", "rakuma", "paypay", "jimoty", "google"]);
});

test("検索ワードは前後空白を除き、全角・連続スペースを半角1つにする", () => {
  assert.equal(normalizeKeyword("　 iPhone　　ケース  黒 "), "iPhone ケース 黒");
  assert.equal(normalizeKeyword("   "), "");
});

test("空ワードでは URL を作らない", () => {
  assert.equal(buildUrl("amazon", "　"), null);
});

test("予約文字を含むワードがクエリ／パスで分断されない（アプリのテストと同じケース）", () => {
  for (const kw of ["H&M", "C++", "#10", "50%オフ", "a/b", "カメラ 中古"]) {
    const enc = encodeURIComponent(kw);
    assert.equal(buildUrl("amazon", kw), `https://www.amazon.co.jp/s?k=${enc}`);
    assert.equal(buildUrl("rakuten", kw), `https://search.rakuten.co.jp/search/mall/${enc}/`);
    assert.equal(buildUrl("paypay", kw), `https://paypayfleamarket.yahoo.co.jp/search/${enc}`);
    assert.equal(new URL(buildUrl("mercari", kw)).searchParams.get("keyword"), kw);
    assert.equal(new URL(buildUrl("yahoo", kw)).searchParams.get("p"), kw);
  }
});

test("各サイトのベースURLはアプリの SearchUrls と一致", () => {
  const k = "camera";
  assert.equal(buildUrl("yodobashi", k), "https://www.yodobashi.com/?word=camera");
  assert.equal(buildUrl("rakuma", k), "https://fril.jp/s?query=camera");
  assert.equal(buildUrl("jimoty", k), "https://jmty.jp/all/sale?keyword=camera");
  assert.equal(buildUrl("google", k), "https://www.google.com/search?q=camera");
});

test("フリマ向けオプションはアプリと同じパラメータ（販売中・送料込み）", () => {
  const o = { onSale: true, shippingIncluded: true };
  const m = new URL(buildUrl("mercari", "camera", o));
  assert.equal(m.searchParams.get("status"), "on_sale");
  assert.equal(m.searchParams.get("shipping_payer_id"), "2");
  const r = new URL(buildUrl("rakuma", "camera", o));
  assert.equal(r.searchParams.get("transaction"), "selling");
  assert.equal(r.searchParams.get("carriage"), "1");
  const p = new URL(buildUrl("paypay", "camera", o));
  assert.equal(p.searchParams.get("open"), "1");
  assert.equal(p.searchParams.has("shipping_payer_id"), false); // 全品送料込み
  // オプションOFFなら付かない
  assert.equal(buildUrl("mercari", "camera"), "https://jp.mercari.com/search?keyword=camera");
  // EC サイトには効かない
  assert.equal(buildUrl("amazon", "camera", o), "https://www.amazon.co.jp/s?k=camera");
});

test("巡回：選択中のうち未訪問の先頭を返し、全部開いたら null", () => {
  assert.equal(nextSite(["rakuten", "mercari"], []), "rakuten");
  assert.equal(nextSite(["rakuten", "mercari"], ["rakuten"]), "mercari");
  assert.equal(nextSite(["rakuten", "mercari"], ["rakuten", "mercari"]), null);
  assert.equal(nextSite([], []), null);
});
