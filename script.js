(() => {
  const CACHE_KEY = "millennium_kzt_rub_rate_v2";

  async function getRate() {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");

    if (Date.now() - cached.timestamp < 4 * 3600_000) return cached.rate;

    const get = (url) =>
      fetch(url)
        .then((r) => r.json())
        .catch(() => ({}));

    const d1 = await get("https://open.er-api.com/v6/latest/KZT");

    const d2 =
      !d1.rates &&
      (await get(
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/kzt.min.json",
      ));

    const rate = d1.rates?.RUB || d2?.kzt?.rub;

    if (rate)
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rate, timestamp: Date.now() }),
      );

    return rate || cached.rate || 0.195;
  }

  function parseKzt(text) {
    const match = text.match(/(\d[\d\s.,\u00A0\u202F]*)\s*₸/);

    return match
      ? parseFloat(
          match[1]
            .replace(/[,.](\d{1,2})$/, "_$1")
            .replace(/[^\d_]/g, "")
            .replace("_", "."),
        )
      : 0;
  }

  function getPriceType(el) {
    if (
      el.matches(
        "strike, s, del, .discount_original_price, [class*='OriginalPrice']",
      ) ||
      el.nextElementSibling?.textContent.includes("₸") ||
      getComputedStyle(el).textDecorationLine.includes("line-through")
    )
      return "original";

    if (
      el.matches(
        ".discount_final_price, [class*='FinalPrice'], [class*='Discounted']",
      ) ||
      el.closest(".discount_block") ||
      el.previousElementSibling?.textContent.includes("₸") ||
      /-\s*\d+\s*%/.test(el.parentElement?.parentElement?.textContent)
    )
      return "discount";

    return "normal";
  }

  function convertPrices(rate) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );

    const nodes = [];

    let node;

    while ((node = walker.nextNode())) {
      const p = node.parentElement;

      if (
        node.nodeValue.includes("₸") &&
        p &&
        !/SCRIPT|STYLE|TEXTAREA|INPUT|CODE/.test(p.tagName) &&
        !p.closest("[data-kzt-converted]")
      ) {
        nodes.push(node);
      }
    }

    for (const textNode of nodes) {
      const raw = textNode.nodeValue.trim().replace(/[,.]00(\s*₸)/, "$1");

      const kzt = parseKzt(raw);

      if (!kzt) continue;

      const parent = textNode.parentElement;

      const isSingle = parent.children.length === 0;

      const box = isSingle ? parent : document.createElement("div");

      const type = getPriceType(parent);

      const rub = kzt * rate;

      const rubStr =
        rub.toLocaleString("ru-RU", {
          maximumFractionDigits: rub < 50 ? 2 : 0,
        }) + " ₽";

      box.dataset.kztConverted = "true";

      box.dataset.kztType = type;

      box.innerHTML = `

        <div class="kzt-original-price">${raw}</div>

        <div class="kzt-converted-rub ${type === "discount" ? "kzt-converted-rub--discount" : ""}">${rubStr}</div>

      `;

      if (!isSingle) textNode.replaceWith(box);

      if (box.parentElement?.children.length >= 2) {
        box.parentElement.dataset.kztParentRow = "true";
      }
    }
  }

  async function init() {
    const rate = await getRate();

    convertPrices(rate);

    let timer;

    new MutationObserver(() => {
      clearTimeout(timer);

      timer = setTimeout(() => convertPrices(rate), 100);
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
