import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SITES, normalizeKeyword, buildUrl } = require("../search.js");

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
