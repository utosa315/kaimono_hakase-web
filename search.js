/*
 * かいもの博士 Web 版ツール（アプリのホーム相当）
 * - 検索ワードから各サイトの検索URLを組み立てる（規則はアプリ lib/url_logic と同じ）
 * - フリマ向けの簡易オプション（販売中のみ／送料込みのみ）
 * - サイトのチェック（対象の選択）と「次のサイトを開く」巡回
 *   ブラウザは1クリックで開ける新規タブを原則1つに制限するため、一括ではなく1回1サイトずつ開く
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
    { id: "amazon", name: { ja: "アマゾン", en: "Amazon" }, domain: "amazon.co.jp", color: "#ff9900",
      build: function (k) { return "https://www.amazon.co.jp/s?k=" + encodeKeyword(k); } },
    { id: "rakuten", name: { ja: "楽天市場", en: "Rakuten" }, domain: "rakuten.co.jp", color: "#bf0000",
      build: function (k) { return "https://search.rakuten.co.jp/search/mall/" + encodeKeyword(k) + "/"; } },
    { id: "yodobashi", name: { ja: "ヨドバシ・ドット・コム", en: "Yodobashi" }, domain: "yodobashi.com", color: "#d81e1e",
      build: function (k) { return "https://www.yodobashi.com/?word=" + encodeKeyword(k); } },
    { id: "yahoo", name: { ja: "Yahoo!ショッピング", en: "Yahoo! Shopping" }, domain: "shopping.yahoo.co.jp", color: "#ff0033",
      build: function (k) { return "https://shopping.yahoo.co.jp/search?p=" + encodeKeyword(k); } },
    { id: "mercari", name: { ja: "メルカリ", en: "Mercari" }, domain: "jp.mercari.com", color: "#ff0211", flea: true,
      build: function (k, o) {
        return withParams("https://jp.mercari.com/search", {
          keyword: k,
          status: o.onSale ? "on_sale" : "",
          shipping_payer_id: o.shippingIncluded ? "2" : ""
        });
      } },
    { id: "rakuma", name: { ja: "楽天ラクマ", en: "Rakuten Rakuma" }, domain: "fril.jp", color: "#e60033", flea: true,
      build: function (k, o) {
        return withParams("https://fril.jp/s", {
          query: k,
          transaction: o.onSale ? "selling" : "",
          carriage: o.shippingIncluded ? "1" : ""
        });
      } },
    { id: "paypay", name: { ja: "Yahoo!フリマ", en: "Yahoo! Fleamarket" }, domain: "paypayfleamarket.yahoo.co.jp", color: "#ff0033", flea: true,
      build: function (k, o) {
        // Yahoo!フリマは全品送料込みなので shippingIncluded は付けるものが無い
        return withParams("https://paypayfleamarket.yahoo.co.jp/search/" + encodeKeyword(k), {
          open: o.onSale ? "1" : ""
        });
      } },
    { id: "jimoty", name: { ja: "ジモティー", en: "Jimoty" }, domain: "jmty.jp", color: "#1ba9e1",
      build: function (k) { return "https://jmty.jp/all/sale?keyword=" + encodeKeyword(k); } },
    { id: "google", name: { ja: "Google", en: "Google" }, domain: "google.com", color: "#4285f4",
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

  /**
   * 巡回の状態：選択中サイトのうち、まだ開いていない先頭を返す。
   * keyword やオプション、選択が変わったら visited はリセットする（呼び出し側）。
   */
  function nextSite(selectedIds, visitedIds) {
    for (var i = 0; i < SITES.length; i++) {
      var id = SITES[i].id;
      if (selectedIds.indexOf(id) >= 0 && visitedIds.indexOf(id) < 0) return id;
    }
    return null;
  }

  var api = { SITES: SITES, DEFAULT_OPTIONS: DEFAULT_OPTIONS, normalizeKeyword: normalizeKeyword,
    encodeKeyword: encodeKeyword, buildUrl: buildUrl, nextSite: nextSite };

  // ---------------- ブラウザ側 UI ----------------
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      var input = document.getElementById("kw");
      var list = document.getElementById("site-list");
      var nextBtn = document.getElementById("next-btn");
      var progress = document.getElementById("progress");
      var optOnSale = document.getElementById("opt-onsale");
      var optShip = document.getElementById("opt-ship");
      if (!input || !list || !nextBtn) return;

      var STORAGE = "kh.selected";
      var lang = function () { return document.documentElement.lang === "en" ? "en" : "ja"; };
      var selected = SITES.map(function (s) { return s.id; });
      try {
        var saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
        if (Array.isArray(saved) && saved.length) selected = saved.filter(function (id) { return SITES.some(function (s) { return s.id === id; }); });
      } catch (e) {}
      var visited = [];

      function options() { return { onSale: !!(optOnSale && optOnSale.checked), shippingIncluded: !!(optShip && optShip.checked) }; }
      function t(ja, en) { return lang() === "en" ? en : ja; }

      // サイト行を生成（チェック＝巡回の対象、行右の「開く」＝単体で開く）
      SITES.forEach(function (site) {
        var row = document.createElement("div");
        row.className = "site-row";
        row.dataset.site = site.id;
        row.innerHTML =
          '<label class="site-check"><input type="checkbox"><span class="site-badge" aria-hidden="true"></span>' +
          '<span class="site-text"><strong></strong><span></span></span></label>' +
          '<a class="site-open" target="_blank" rel="noopener noreferrer"></a>';
        row.querySelector(".site-badge").style.background = site.color;
        row.querySelector(".site-badge").textContent = site.name.ja.charAt(0);
        var cb = row.querySelector("input");
        cb.checked = selected.indexOf(site.id) >= 0;
        cb.addEventListener("change", function () {
          if (cb.checked) { if (selected.indexOf(site.id) < 0) selected.push(site.id); }
          else selected = selected.filter(function (id) { return id !== site.id; });
          try { localStorage.setItem(STORAGE, JSON.stringify(selected)); } catch (e) {}
          refresh();
        });
        list.appendChild(row);
      });

      function markVisited(id) {
        if (visited.indexOf(id) < 0) visited.push(id);
        refresh();
      }

      function refresh() {
        var kw = normalizeKeyword(input.value);
        var o = options();
        document.querySelectorAll(".site-row").forEach(function (row) {
          var site = SITES.filter(function (s) { return s.id === row.dataset.site; })[0];
          row.querySelector("strong").textContent = site.name[lang()];
          row.querySelector(".site-text > span").textContent = site.domain;
          var a = row.querySelector(".site-open");
          var url = buildUrl(site.id, kw, o);
          a.textContent = t("開く", "Open");
          a.setAttribute("aria-label", t(site.name.ja + "で検索", "Search on " + site.name.en));
          if (url) { a.href = url; a.classList.remove("is-disabled"); a.removeAttribute("aria-disabled"); }
          else { a.href = "#"; a.classList.add("is-disabled"); a.setAttribute("aria-disabled", "true"); }
          row.classList.toggle("is-visited", visited.indexOf(site.id) >= 0);
          row.classList.toggle("is-off", selected.indexOf(site.id) < 0);
        });
        var total = selected.length;
        var done = visited.filter(function (id) { return selected.indexOf(id) >= 0; }).length;
        var next = nextSite(selected, visited);
        var nextSiteObj = next ? SITES.filter(function (s) { return s.id === next; })[0] : null;
        nextBtn.disabled = !kw || !nextSiteObj;
        if (!kw) nextBtn.textContent = t("検索ワードを入力してください", "Enter a keyword first");
        else if (!total) nextBtn.textContent = t("サイトを選んでください", "Select at least one site");
        else if (nextSiteObj) nextBtn.textContent = t("次のサイトを開く：" + nextSiteObj.name.ja, "Open next: " + nextSiteObj.name.en);
        else nextBtn.textContent = t("すべて開きました（もう一周する）", "All opened. Start over");
        if (progress) progress.textContent = total ? (done + " / " + total) : "";
        if (!nextSiteObj && total && kw) nextBtn.disabled = false; // もう一周
      }

      function resetVisited() { visited = []; refresh(); }

      input.addEventListener("input", resetVisited);
      if (optOnSale) optOnSale.addEventListener("change", resetVisited);
      if (optShip) optShip.addEventListener("change", resetVisited);

      nextBtn.addEventListener("click", function () {
        var kw = normalizeKeyword(input.value);
        if (!kw) { input.focus(); return; }
        var next = nextSite(selected, visited);
        if (!next) { resetVisited(); return; } // もう一周
        var url = buildUrl(next, kw, options());
        // クリック起点なのでポップアップブロックに掛からない（1回に1タブ）
        window.open(url, "_blank", "noopener");
        markVisited(next);
      });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); nextBtn.click(); } });
      list.addEventListener("click", function (e) {
        var a = e.target.closest("a.site-open");
        if (!a) return;
        if (a.classList.contains("is-disabled")) { e.preventDefault(); input.focus(); return; }
        markVisited(a.closest(".site-row").dataset.site);
      });
      document.addEventListener("click", function (e) { if (e.target.closest("[data-set-lang]")) setTimeout(refresh, 0); });
      refresh();
    });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.KaimonoHakaseSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
