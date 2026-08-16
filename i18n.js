(function () {
  var html = document.documentElement;

  function detect() {
    try {
      var params = new URLSearchParams(location.search);
      var query = params.get("lang");
      if (query === "ja" || query === "en") {
        localStorage.setItem("lang", query);
        return query;
      }
    } catch (e) {}

    try {
      var stored = localStorage.getItem("lang");
      if (stored === "ja" || stored === "en") return stored;
    } catch (e) {}

    var languages = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "ja"];
    for (var i = 0; i < languages.length; i++) {
      var tag = String(languages[i] || "").toLowerCase();
      if (tag.indexOf("ja") === 0) return "ja";
      if (tag.indexOf("en") === 0) return "en";
    }
    return "ja";
  }

  function apply(lang) {
    html.lang = lang;
    var title = document.querySelector("title");
    if (title && title.dataset[lang]) document.title = title.dataset[lang];
    var description = document.querySelector('meta[name="description"]');
    if (description && description.dataset[lang]) {
      description.setAttribute("content", description.dataset[lang]);
    }
  }

  apply(detect());

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-set-lang]");
    if (!button) return;
    var next = button.getAttribute("data-set-lang");
    if (next !== "ja" && next !== "en") return;
    try { localStorage.setItem("lang", next); } catch (e) {}
    apply(next);
  });
})();
