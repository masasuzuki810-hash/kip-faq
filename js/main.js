(function () {
  "use strict";

  // カテゴリの表示順（データ側の並びに関わらずこの順で表示する）
  var CATEGORY_ORDER = [
    "導入・基本",
    "カード選択後の指導",
    "困った時の対応・ワーク活用",
    "安全に関わる判断",
    "保護者向け"
  ];

  var root = document.getElementById("faq-root");
  var loadingMessage = document.getElementById("loading-message");
  var noResultsMessage = document.getElementById("no-results");
  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var resultCount = document.getElementById("result-count");

  var allItems = []; // { id, category, question, answer, el, questionEl, answerEl }
  var totalCount = 0;

  fetch("data/qa.json")
    .then(function (res) {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return res.json();
    })
    .then(function (data) {
      totalCount = data.length;
      renderFaq(data);
      loadingMessage.remove();
      searchInput.disabled = false;
      searchInput.addEventListener("input", onSearchInput);
      searchClear.addEventListener("click", clearSearch);
      updateResultCount(totalCount, totalCount);
    })
    .catch(function (err) {
      loadingMessage.textContent =
        "Q&Aの読み込みに失敗しました。ページを再読み込みしてみてください。";
      console.error(err);
    });

  function renderFaq(data) {
    // カテゴリごとにグループ化
    var grouped = {};
    data.forEach(function (item) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    // 表示順（定義済みの順 → その他は登場順で末尾に追加）
    var orderedCategories = CATEGORY_ORDER.filter(function (c) {
      return grouped[c];
    });
    Object.keys(grouped).forEach(function (c) {
      if (orderedCategories.indexOf(c) === -1) {
        orderedCategories.push(c);
      }
    });

    orderedCategories.forEach(function (category) {
      var items = grouped[category];

      var section = document.createElement("section");
      section.className = "category-section";
      section.setAttribute("data-category-section", "");

      var titleWrap = document.createElement("h2");
      titleWrap.className = "category-title";

      var titleText = document.createElement("span");
      titleText.textContent = category;
      titleWrap.appendChild(titleText);

      var countBadge = document.createElement("span");
      countBadge.className = "category-count";
      countBadge.textContent = items.length + "件";
      titleWrap.appendChild(countBadge);

      section.appendChild(titleWrap);

      var list = document.createElement("div");
      list.className = "qa-list";

      items.forEach(function (item, index) {
        var details = document.createElement("details");
        details.className = "qa-item";

        var summary = document.createElement("summary");

        var badge = document.createElement("span");
        badge.className = "qa-badge";
        badge.textContent = "Q";

        var questionSpan = document.createElement("span");
        questionSpan.className = "qa-question-text";
        questionSpan.textContent = item.question;

        summary.appendChild(badge);
        summary.appendChild(questionSpan);
        details.appendChild(summary);

        var answerWrap = document.createElement("div");
        answerWrap.className = "qa-answer";

        // 改行区切りで段落を作る
        item.answer.split("\n").forEach(function (line) {
          if (line.trim() === "") return;
          var p = document.createElement("p");
          p.textContent = line;
          answerWrap.appendChild(p);
        });

        details.appendChild(answerWrap);
        list.appendChild(details);

        allItems.push({
          id: item.id,
          category: category,
          question: item.question,
          answer: item.answer,
          el: details,
          sectionEl: section,
          questionSpan: questionSpan,
          answerWrap: answerWrap
        });
      });

      section.appendChild(list);
      root.appendChild(section);
    });
  }

  var searchDebounceTimer = null;

  function onSearchInput() {
    searchClear.hidden = searchInput.value.length === 0;
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(applySearch, 80);
  }

  function clearSearch() {
    searchInput.value = "";
    searchClear.hidden = true;
    applySearch();
    searchInput.focus();
  }

  function applySearch() {
    var rawQuery = searchInput.value.trim();
    var query = rawQuery.toLowerCase();
    var visibleCount = 0;

    if (!query) {
      allItems.forEach(function (item) {
        item.el.hidden = false;
        item.el.open = false;
        setHighlighted(item.questionSpan, item.question);
        renderAnswer(item.answerWrap, item.answer);
      });
      visibleCount = allItems.length;
    } else {
      allItems.forEach(function (item) {
        var haystack = (item.question + " " + item.answer).toLowerCase();
        var matches = haystack.indexOf(query) !== -1;
        item.el.hidden = !matches;
        if (matches) {
          visibleCount++;
          item.el.open = true;
          setHighlighted(item.questionSpan, item.question, rawQuery);
          renderAnswer(item.answerWrap, item.answer, rawQuery);
        } else {
          item.el.open = false;
        }
      });
    }

    // カテゴリ見出しの表示・非表示（該当0件のカテゴリは隠す）
    var sections = root.querySelectorAll("[data-category-section]");
    sections.forEach(function (section) {
      var visibleInSection = section.querySelectorAll(
        ".qa-item:not([hidden])"
      ).length;
      section.hidden = visibleInSection === 0;
    });

    noResultsMessage.hidden = visibleCount !== 0;
    updateResultCount(visibleCount, totalCount);
  }

  function updateResultCount(visible, total) {
    if (!searchInput.value.trim()) {
      resultCount.textContent = total + "件の質問があります";
    } else {
      resultCount.textContent = total + "件中 " + visible + "件が見つかりました";
    }
  }

  function renderAnswer(container, text, query) {
    container.innerHTML = "";
    text.split("\n").forEach(function (line) {
      if (line.trim() === "") return;
      var p = document.createElement("p");
      appendHighlighted(p, line, query);
      container.appendChild(p);
    });
  }

  function setHighlighted(el, text, query) {
    el.innerHTML = "";
    appendHighlighted(el, text, query);
  }

  // query があれば一致箇所を <mark> で囲みつつテキストを追加する（XSS対策のためDOM操作のみで組み立てる）
  function appendHighlighted(el, text, query) {
    if (!query) {
      el.appendChild(document.createTextNode(text));
      return;
    }
    var lowerText = text.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var start = 0;
    var idx = lowerText.indexOf(lowerQuery, start);

    if (idx === -1) {
      el.appendChild(document.createTextNode(text));
      return;
    }

    while (idx !== -1) {
      if (idx > start) {
        el.appendChild(document.createTextNode(text.slice(start, idx)));
      }
      var mark = document.createElement("mark");
      mark.textContent = text.slice(idx, idx + query.length);
      el.appendChild(mark);
      start = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, start);
    }
    if (start < text.length) {
      el.appendChild(document.createTextNode(text.slice(start)));
    }
  }
})();
