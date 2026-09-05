/*
 * かいもの博士 Web 版ミニツール：検索ワードから各サイトの検索URLを組み立てて開く。
 * URL の規則はアプリ（lib/url_logic/*）と同じ。アプリ側を変えたらここも合わせる。
 * ここではオプション（絞り込み）は付けず、キーワード検索だけを提供する。
 * アフィリエイトのパラメータは付けない（Web 媒体の登録後に別途検討）。
 */
(function (global) {
  "use strict";

  /** 前後の空白を除き、全角スペースを含む連続した空白を半角1つにする（アプリと同じ正規化） */
  function normalizeKeyword(raw) {
    return String(raw || "").replace(/[\s　]+/g, " ").trim();
  }

  /** クエリ値・パス要素のどちらに置いても安全なようにエンコードする（アプリの encodeKeyword と同じ） */
  function encodeKeyword(keyword) {
    return encodeURIComponent(keyword);
  }

  /** 表示順はアプリのホームと同じ */
  var SITES = [
    { id: "amazon", name: { ja: "アマゾン", en: "Amazon" }, domain: "amazon.co.jp",
      build: function (k) { return "https://www.amazon.co.jp/s?k=" + encodeKeyword(k); } },
    { id: "rakuten", name: { ja: "楽天市場", en: "Rakuten" }, domain: "rakuten.co.jp",
      build: function (k) { return "https://search.rakuten.co.jp/search/mall/" + encodeKeyword(k) + "/"; } },
    { id: "yodobashi", name: { ja: "ヨドバシ・ドット・コム", en: "Yodobashi" }, domain: "yodobashi.com",
      build: function (k) { return "https://www.yodobashi.com/?word=" + encodeKeyword(k); } },
    { id: "yahoo", name: { ja: "Yahoo!ショッピング", en: "Yahoo! Shopping" }, domain: "shopping.yahoo.co.jp",
      build: function (k) { return "https://shopping.yahoo.co.jp/search?p=" + encodeKeyword(k); } },
    { id: "mercari", name: { ja: "メルカリ", en: "Mercari" }, domain: "jp.mercari.com",
      build: function (k) { return "https://jp.mercari.com/search?keyword=" + encodeKeyword(k); } },
    { id: "rakuma", name: { ja: "楽天ラクマ", en: "Rakuten Rakuma" }, domain: "fril.jp",
      build: function (k) { return "https://fril.jp/s?query=" + encodeKeyword(k); } },
    { id: "paypay", name: { ja: "Yahoo!フリマ", en: "Yahoo! Fleamarket" }, domain: "paypayfleamarket.yahoo.co.jp",
      build: function (k) { return "https://paypayfleamarket.yahoo.co.jp/search/" + encodeKeyword(k); } },
    { id: "jimoty", name: { ja: "ジモティー", en: "Jimoty" }, domain: "jmty.jp",
      build: function (k) { return "https://jmty.jp/all/sale?keyword=" + encodeKeyword(k); } },
    { id: "google", name: { ja: "Google", en: "Google" }, domain: "google.com",
      build: function (k) { return "https://www.google.com/search?q=" + encodeKeyword(k); } }
  ];

  function buildUrl(siteId, rawKeyword) {
    var keyword = normalizeKeyword(rawKeyword);
    if (!keyword) return null;
    for (var i = 0; i < SITES.length; i++) {
      if (SITES[i].id === siteId) return SITES[i].build(keyword);
    }
    return null;
  }

  var api = { SITES: SITES, normalizeKeyword: normalizeKeyword, encodeKeyword: encodeKeyword, buildUrl: buildUrl };

  // ブラウザ：ツールの描画と操作
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      var input = document.getElementById("kw");
      var lists = document.querySelectorAll("[data-site-list]");
      if (!input || !lists.length) return;

      lists.forEach(function (list) {
        var lang = list.getAttribute("data-site-list") === "en" ? "en" : "ja";
        SITES.forEach(function (site) {
          var a = document.createElement("a");
          a.className = "site";
          a.href = "#";
          a.rel = "noopener noreferrer";
          a.target = "_blank";
          a.dataset.site = site.id;
          a.innerHTML = "<strong></strong><span></span>";
          a.querySelector("strong").textContent = site.name[lang];
          a.querySelector("span").textContent = site.domain;
          list.appendChild(a);
        });
      });

      function refresh() {
        var keyword = normalizeKeyword(input.value);
        document.querySelectorAll("a.site").forEach(function (a) {
          var url = buildUrl(a.dataset.site, keyword);
          if (url) {
            a.href = url;
            a.classList.remove("is-disabled");
            a.removeAttribute("aria-disabled");
          } else {
            a.href = "#";
            a.classList.add("is-disabled");
            a.setAttribute("aria-disabled", "true");
          }
        });
      }

      input.addEventListener("input", refresh);
      document.addEventListener("click", function (event) {
        var a = event.target.closest("a.site");
        if (!a) return;
        if (a.classList.contains("is-disabled")) {
          event.preventDefault();
          input.focus();
        }
      });
      input.addEventListener("keydown", function (event) {
        // Enter で最初のサイト（アプリと同じ並びで先頭）を開く
        if (event.key === "Enter") {
          var first = document.querySelector(".i18n:not([hidden]) a.site, a.site");
          var url = buildUrl(SITES[0].id, input.value);
          if (url) window.open(url, "_blank", "noopener");
          else if (first) input.focus();
        }
      });
      refresh();
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.KaimonoHakaseSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
