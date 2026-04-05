(() => {
  const catalog = window.REYVAL_CATALOG || { categories: [], products: [] };
  const SEARCH_RESULT_LIMIT = 6;
  const pageMap = {
    men: 'men.html',
    women: 'women.html',
    children: 'children.html',
    accessories: 'accessories.html'
  };
  const categoryAliases = {
    men: 'mens men gents male',
    women: 'womens women ladies female',
    children: 'children child kids kid toddler baby',
    accessories: 'accessories accessory bag bags wallet wallets jewellery jewelry fashion extras'
  };

  const searchState = {
    label: (new URLSearchParams(window.location.search).get('q') || '').trim()
  };

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getSearchTerms(value) {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  }

  function getLocationForProduct(product) {
    const category = catalog.categories.find(entry => entry.id === product.category);

    return {
      href: pageMap[product.category] || 'home.html',
      label: `${product.categoryLabel || category?.label || 'Catalog'} Collection`,
      copy: category?.blurb || 'Open the collection page to continue exploring related products.'
    };
  }

  function productMatchesSearch(product, searchValue) {
    const terms = getSearchTerms(searchValue);
    if (!terms.length) return true;

    const haystack = normalizeSearchText([
      product.name,
      product.description,
      product.categoryLabel,
      product.category,
      product.sourceLabel,
      categoryAliases[product.category] || ''
    ].join(' '));

    return terms.every(term => haystack.includes(term));
  }

  function buildSearchCard(product) {
    const location = getLocationForProduct(product);

    return `
      <article class="product-card search-result-card">
        <div class="product-media">
          <img src="${product.imageUrl}" alt="${product.name}" loading="lazy">
          <span class="product-badge">Search Result</span>
        </div>
        <div class="product-content">
          <div class="product-meta">${product.categoryLabel} &middot; ${product.sourceLabel || 'Curated edit'}</div>
          <h3 class="product-name">${product.name}</h3>
          <p class="product-description">${product.description}</p>

          <div class="search-result-location">
            <span class="location-kicker">Location</span>
            <a class="location-link" href="${location.href}">${location.label}</a>
            <p class="location-copy">${location.copy}</p>
          </div>

          <div class="price-row">
            <span class="price-new">${formatCurrency(product.price)}</span>
            <span class="price-old">${formatCurrency(product.originalPrice)}</span>
          </div>

          <div class="search-result-actions">
            <button class="product-button" onclick="addItemToBag('${product.id}')">Add to Cart</button>
            <a class="search-open-button" href="${location.href}">Open Page</a>
          </div>
        </div>
      </article>
    `;
  }

  function updateSearchUrl(value) {
    const url = new URL(window.location.href);
    const trimmedValue = (value || '').trim();

    if (trimmedValue) {
      url.searchParams.set('q', trimmedValue);
    } else {
      url.searchParams.delete('q');
    }

    window.history.replaceState({}, '', url.toString());
  }

  function renderCategoryLinks() {
    const target = document.getElementById('search-category-links');
    if (!target) return;

    target.innerHTML = catalog.categories.map(category => `
      <a class="category-link" href="${pageMap[category.id] || 'home.html'}">
        <span>${category.label}</span>
        <span aria-hidden="true">Open collection</span>
      </a>
    `).join('');
  }

  function updateStatus(matchCount, visibleCount) {
    const target = document.getElementById('search-page-status');
    if (!target) return;

    const label = searchState.label.trim();
    if (!label) {
      target.textContent = `Search the catalog to reveal up to ${SEARCH_RESULT_LIMIT} matching products with their collection location.`;
      return;
    }

    if (!matchCount) {
      target.textContent = `No products found for "${label}". Try a broader keyword like shirt, dress, kids, or bag.`;
      return;
    }

    target.textContent = matchCount > visibleCount
      ? `Found ${matchCount} products for "${label}". Showing the first ${visibleCount} matches with their collection location.`
      : `Found ${matchCount} product${matchCount === 1 ? '' : 's'} for "${label}". Each result includes its collection location.`;
  }

  function renderResults() {
    const target = document.getElementById('search-results');
    if (!target) return;

    if (!searchState.label.trim()) {
      target.innerHTML = `
        <div class="catalog-empty search-empty-state">
          Product cards stay hidden until you search. Enter a keyword to see up to ${SEARCH_RESULT_LIMIT} matching results and where each product lives.
        </div>
      `;
      updateStatus(0, 0);
      return;
    }

    const matches = catalog.products.filter(product => productMatchesSearch(product, searchState.label));
    const visibleMatches = matches.slice(0, SEARCH_RESULT_LIMIT);

    target.innerHTML = visibleMatches.length
      ? visibleMatches.map(buildSearchCard).join('')
      : `
        <div class="catalog-empty search-empty-state">
          No products matched your search. Try a simpler keyword or browse one of the collection links above to explore by location.
        </div>
      `;

    updateStatus(matches.length, visibleMatches.length);
  }

  function applySearch(value) {
    searchState.label = (value || '').trim();
    updateSearchUrl(searchState.label);
    renderResults();
  }

  function bindSearchForm() {
    const form = document.getElementById('search-page-form');
    const input = document.getElementById('search-page-input');
    const clear = document.getElementById('search-page-clear');
    if (!form || !input || !clear) return;

    input.value = searchState.label;

    form.addEventListener('submit', event => {
      event.preventDefault();
      applySearch(input.value);
    });

    clear.addEventListener('click', () => {
      input.value = '';
      applySearch('');
      input.focus();
    });
  }

  function renderPage() {
    bindSearchForm();
    renderCategoryLinks();
    renderResults();
  }

window.ReyvalSearch = {
    renderPage
  };
})();
