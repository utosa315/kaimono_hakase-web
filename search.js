/*
 * かいもの博士 Web 版ツール（アプリのホーム相当）
 * - 検索ワードから各サイトの検索URLを組み立てる（規則はアプリ lib/url_logic と同じ）
 * - フリマ向けの簡易オプション（販売中のみ／送料込みのみ）
 * - サイトのカードを押すとそのサイトの検索結果を新しいタブで開く（アプリのホームと同じ操作）
 * アフィリエイトのパラメータは付けない（Web 媒体の登録後に別途検討）
 */
(function (global) {
  "use strict";

  function normalizeKeyword(raw) {
    return String(raw || "").replace(/[\s　]+/g, " ").trim();
  }
  function encodeKeyword(keyword) {
    return encodeURIComponent(keyword);
  }
  function withParams(base, params) {
    var q = Object.keys(params).filter(function (k) { return params[k] !== "" && params[k] != null; })
      .map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return q ? base + "?" + q : base;
  }

  /** 表示順・IDはアプリの SearchSite と同じ。flea: フリマ系オプションが効くサイト */
  var SITES = [
    { id: "amazon", name: { ja: "アマゾン", en: "Amazon" }, domain: "amazon.co.jp", icon: "assets/sites/amazon.webp",
      build: function (k) { return "https://www.amazon.co.jp/s?k=" + encodeKeyword(k); } },
    { id: "rakuten", name: { ja: "楽天市場", en: "Rakuten" }, domain: "rakuten.co.jp", icon: "assets/sites/rakuten.webp",
      build: function (k) { return "https://search.rakuten.co.jp/search/mall/" + encodeKeyword(k) + "/"; } },
    { id: "yodobashi", name: { ja: "ヨドバシ・ドット・コム", en: "Yodobashi" }, domain: "yodobashi.com", icon: "assets/sites/yodobashi.webp",
      build: function (k) { return "https://www.yodobashi.com/?word=" + encodeKeyword(k); } },
    { id: "yahoo", name: { ja: "Yahoo!ショッピング", en: "Yahoo! Shopping" }, domain: "shopping.yahoo.co.jp", icon: "assets/sites/yahoo.webp",
      build: function (k) { return "https://shopping.yahoo.co.jp/search?p=" + encodeKeyword(k); } },
    { id: "mercari", name: { ja: "メルカリ", en: "Mercari" }, domain: "jp.mercari.com", icon: "assets/sites/mercari.png", flea: true,
      build: function (k, o) {
        return withParams("https://jp.mercari.com/search", {
          keyword: k,
          status: o.onSale ? "on_sale" : "",
          shipping_payer_id: o.shippingIncluded ? "2" : ""
        });
      } },
    { id: "rakuma", name: { ja: "楽天ラクマ", en: "Rakuten Rakuma" }, domain: "fril.jp", icon: "assets/sites/rakuma.webp", flea: true,
      build: function (k, o) {
        return withParams("https://fril.jp/s", {
          query: k,
          transaction: o.onSale ? "selling" : "",
          carriage: o.shippingIncluded ? "1" : ""
        });
      } },
    { id: "paypay", name: { ja: "Yahoo!フリマ", en: "Yahoo! Fleamarket" }, domain: "paypayfleamarket.yahoo.co.jp", icon: "assets/sites/paypay.webp", flea: true,
      build: function (k, o) {
        // Yahoo!フリマは全品送料込みなので shippingIncluded は付けるものが無い
        return withParams("https://paypayfleamarket.yahoo.co.jp/search/" + encodeKeyword(k), {
          open: o.onSale ? "1" : ""
        });
      } },
    { id: "jimoty", name: { ja: "ジモティー", en: "Jimoty" }, domain: "jmty.jp", icon: "assets/sites/jimoty.webp",
      build: function (k) { return "https://jmty.jp/all/sale?keyword=" + encodeKeyword(k); } },
    { id: "google", name: { ja: "Google", en: "Google" }, domain: "google.com", icon: "assets/sites/google.webp",
      build: function (k) { return "https://www.google.com/search?q=" + encodeKeyword(k); } }
  ];

  var DEFAULT_OPTIONS = { onSale: false, shippingIncluded: false };

  function buildUrl(siteId, rawKeyword, options) {
    var keyword = normalizeKeyword(rawKeyword);
    if (!keyword) return null;
    var o = Object.assign({}, DEFAULT_OPTIONS, options || {});
    for (var i = 0; i < SITES.length; i++) {
      if (SITES[i].id === siteId) return SITES[i].build(keyword, o);
    }
    return null;
  }


  var api = { SITES: SITES, DEFAULT_OPTIONS: DEFAULT_OPTIONS, normalizeKeyword: normalizeKeyword,
    encodeKeyword: encodeKeyword, buildUrl: buildUrl };

  // ---------------- ブラウザ側 UI ----------------
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      var input = document.getElementById("kw");
      var list = document.getElementById("site-list");
      var optOnSale = document.getElementById("opt-onsale");
      var optShip = document.getElementById("opt-ship");
      if (!input || !list) return;

      var lang = function () { return document.documentElement.lang === "en" ? "en" : "ja"; };
      var visited = [];
      function options() { return { onSale: !!(optOnSale && optOnSale.checked), shippingIncluded: !!(optShip && optShip.checked) }; }
      function t(ja, en) { return lang() === "en" ? en : ja; }

      // サイトカード（アプリのホームと同じ：アイコン・サイト名・ドメイン・矢印）
      SITES.forEach(function (site) {
        var a = document.createElement("a");
        a.className = "site-card";
        a.dataset.site = site.id;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.innerHTML = '<img class="site-icon" alt="" width="40" height="40">' +
          '<span class="site-text"><strong></strong><span></span></span>' +
          '<span class="site-arrow" aria-hidden="true">&#8594;</span>';
        a.querySelector("img").src = site.icon;
        list.appendChild(a);
      });

      function refresh() {
        var kw = normalizeKeyword(input.value);
        var o = options();
        document.querySelectorAll("a.site-card").forEach(function (a) {
          var site = SITES.filter(function (s) { return s.id === a.dataset.site; })[0];
          a.querySelector("strong").textContent = t(site.name.ja + "で検索", "Search on " + site.name.en);
          a.querySelector(".site-text > span").textContent = site.domain;
          var url = buildUrl(site.id, kw, o);
          if (url) { a.href = url; a.classList.remove("is-disabled"); a.removeAttribute("aria-disabled"); }
          else { a.href = "#"; a.classList.add("is-disabled"); a.setAttribute("aria-disabled", "true"); }
          a.classList.toggle("is-visited", visited.indexOf(site.id) >= 0);
          a.setAttribute("aria-label", t(site.name.ja + "で検索（新しいタブ）", "Search on " + site.name.en + " (new tab)") + (visited.indexOf(site.id) >= 0 ? t("・確認済み", ", checked") : ""));
        });
        var status = document.getElementById("search-status");
        if (status) status.textContent = !kw ? t("商品名を入力するか、上の例を選んでください。", "Enter a product name or select an example above.") :
          visited.length ? t(visited.length + " / 9 サイトを確認済み。次のサイトも探し比べましょう。", visited.length + " / 9 sites checked. Try another site to compare.") :
          t("検索するサイトを選んでください。", "Choose a site to search.");
      }
      function resetVisited() { visited = []; refresh(); }

      input.addEventListener("input", resetVisited);
      if (optOnSale) optOnSale.addEventListener("change", resetVisited);
      if (optShip) optShip.addEventListener("change", resetVisited);
      list.addEventListener("click", function (e) {
        var a = e.target.closest("a.site-card");
        if (!a) return;
        if (a.classList.contains("is-disabled")) { e.preventDefault(); input.focus(); return; }
        // 開いたサイトに✓を付ける（巡回の進み具合が分かる）
        if (visited.indexOf(a.dataset.site) < 0) visited.push(a.dataset.site);
        refresh();
      });
      document.querySelectorAll("[data-keyword]").forEach(function (button) {
        button.addEventListener("click", function () {
          input.value = button.dataset.keyword;
          resetVisited();
          input.focus();
        });
      });
      // IME確定時に送客しない。Enterは検索先の選択へ進める。
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (normalizeKeyword(input.value)) list.querySelector("a.site-card").focus();
      });
      document.addEventListener("click", function (e) { if (e.target.closest("[data-set-lang]")) setTimeout(refresh, 0); });
      refresh();
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.KaimonoHakaseSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
