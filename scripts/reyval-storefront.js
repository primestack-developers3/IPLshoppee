(() => {
  const catalog = window.REYVAL_CATALOG || { generatedAt: null, categories: [], products: [], warnings: ['Catalog data not loaded.'] };
  const categoryIcons = {
    men: 'Tailored Icons',
    women: 'Evening Edit',
    children: 'Little Luxe',
    accessories: 'Finishing Touches'
  };

  const pageMap = {
    men: 'men.html',
    women: 'women.html',
    children: 'children.html',
    accessories: 'accessories.html'
  };
  const homeState = {
    searchLabel: '',
    searchTerm: ''
  };

  const productIndex = new Map();
  catalog.products.forEach(product => productIndex.set(product.id, product));

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  function getCategory(categoryId) {
    return catalog.categories.find(category => category.id === categoryId);
  }

  function getProducts(categoryId) {
    return catalog.products.filter(product => product.category === categoryId);
  }

  function getCategoryUrl(categoryId) {
    return pageMap[categoryId] || 'home.html';
  }

  function normalizeSearchTerm(value) {
    return (value || '').trim().toLowerCase();
  }

  function getRequestedSearch() {
    return (new URLSearchParams(window.location.search).get('search') || '').trim();
  }

  function syncCatalogSearchUrl(searchValue) {
    const url = new URL(window.location.href);
    const trimmedValue = (searchValue || '').trim();
    const shouldPinCatalog = Boolean(trimmedValue) || url.hash === '#catalog';

    if (trimmedValue) {
      url.searchParams.set('search', trimmedValue);
    } else {
      url.searchParams.delete('search');
    }

    url.hash = shouldPinCatalog ? 'catalog' : '';
    window.history.replaceState({}, '', url.toString());
  }

  const requestedSearch = getRequestedSearch();
  homeState.searchLabel = requestedSearch;
  homeState.searchTerm = normalizeSearchTerm(requestedSearch);

  function productMatchesSearch(product, searchTerm) {
    if (!searchTerm) return true;
    const haystack = [
      product.name,
      product.description,
      product.categoryLabel,
      product.category,
      product.sourceLabel
    ].join(' ').toLowerCase();
    return haystack.includes(searchTerm);
  }

  function buildCard(product) {
    return `
      <article class="product-card">
        <div class="product-media">
          <img src="${product.imageUrl}" alt="${product.name}" loading="lazy">
          <span class="product-badge">Reyval Luxury</span>
        </div>
        <div class="product-content">
          <div class="product-meta">${product.categoryLabel} &middot; ${product.sourceLabel || 'Curated edit'}</div>
          <h3 class="product-name">${product.name}</h3>
          <p class="product-description">${product.description}</p>
          <div class="price-row">
            <span class="price-new">${formatCurrency(product.price)}</span>
            <span class="price-old">${formatCurrency(product.originalPrice)}</span>
          </div>
          <button class="product-button" onclick="addItemToBag('${product.id}')">Add to Cart</button>
        </div>
      </article>
    `;
  }

  function renderCategoryLinks(targetId, activeId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = catalog.categories.map(category => `
      <a class="category-link${activeId === category.id ? ' active' : ''}" href="${getCategoryUrl(category.id)}">
        <span>${category.label}</span>
        <span aria-hidden="true">${categoryIcons[category.id] || 'Curated Edit'}</span>
      </a>
    `).join('');
  }

  function renderCategoryTiles(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = catalog.categories.map(category => `
      <a class="category-tile" href="${getCategoryUrl(category.id)}">
        <div class="tile-kicker">${category.sampleCount} curated products</div>
        <h3 class="tile-title">${category.label}</h3>
        <p class="tile-copy">${category.blurb}</p>
      </a>
    `).join('');
  }

  function renderAllSections(targetId, searchTerm = '') {
    const target = document.getElementById(targetId);
    if (!target) return;
    const markup = catalog.categories.map(category => {
      const items = getProducts(category.id).filter(item => productMatchesSearch(item, searchTerm));
      if (!items.length) {
        return '';
      }
      return `
        <section class="collection-section" id="category-${category.id}">
          <div class="collection-heading">
            <div>
              <div class="section-kicker">${items.length} Reyval selection${items.length === 1 ? '' : 's'}</div>
              <h3 class="collection-title">${category.label}</h3>
              <p class="collection-subtitle">${category.blurb}</p>
            </div>
            <div class="catalog-note"><a href="${getCategoryUrl(category.id)}">Open ${category.label} page</a></div>
          </div>
          <div class="product-grid">
            ${items.map(buildCard).join('')}
          </div>
        </section>
      `;
    }).join('');

    target.innerHTML = markup || `
      <div class="catalog-empty">
        No products matched your search. Try a broader keyword such as <strong>dress</strong>, <strong>shirt</strong>, <strong>kids</strong>, or <strong>bag</strong>.
      </div>
    `;
  }

  function renderSourcePanel(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const warningMarkup = (catalog.warnings || []).length
      ? `<p><strong>Sync note:</strong> ${(catalog.warnings || []).join(' ')}</p>`
      : '';
    const sourceMarkup = (catalog.sources || [])
      .map(source => `<div><strong>${source.label}:</strong> <a href="${source.url}" target="_blank" rel="noreferrer">${source.url}</a></div>`)
      .join('');

    target.innerHTML = `
      ${warningMarkup}
      <p><strong>Catalog source targets:</strong> The sync script can pull from Meesho category URLs and refresh this storefront with updated Reyval catalog data.</p>
      ${sourceMarkup}
    `;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function updateHomeSearchStatus() {
    const target = document.getElementById('catalog-search-status');
    if (!target) return;

    const searchTerm = homeState.searchTerm;
    if (!searchTerm) {
      target.textContent = 'Showing all Reyval catalog products.';
      return;
    }

    const count = catalog.products.filter(product => productMatchesSearch(product, searchTerm)).length;
    const searchLabel = homeState.searchLabel || searchTerm;
    target.textContent = count
      ? `Found ${count} product${count === 1 ? '' : 's'} for "${searchLabel}".`
      : `No products found for "${searchLabel}".`;
  }

  function applyCatalogSearch(value, options = {}) {
    const searchLabel = (value || '').trim();
    homeState.searchLabel = searchLabel;
    homeState.searchTerm = normalizeSearchTerm(searchLabel);

    const homeInput = document.getElementById('catalog-search-input');
    if (homeInput && homeInput.value !== searchLabel) {
      homeInput.value = searchLabel;
    }

    renderAllSections('collection-sections', homeState.searchTerm);
    updateHomeSearchStatus();
    syncCatalogSearchUrl(searchLabel);

    const catalogSection = document.getElementById('catalog');
    if (options.scrollToCatalog && catalogSection) {
      catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function bindHomeSearch() {
    const form = document.getElementById('catalog-search-form');
    const input = document.getElementById('catalog-search-input');
    const clear = document.getElementById('catalog-search-clear');
    if (!form || !input || !clear) return;

    input.value = homeState.searchLabel;

    form.addEventListener('submit', event => {
      event.preventDefault();
      applyCatalogSearch(input.value, { scrollToCatalog: true });
    });

    clear.addEventListener('click', () => {
      input.value = '';
      applyCatalogSearch('');
      input.focus();
    });
  }

  function hydrateChrome() {
    fetch('./components/header.html')
      .then(response => response.text())
      .then(html => {
        document.getElementById('header-container').innerHTML = html;
        if (typeof initializeCart === 'function') {
          initializeCart();
        }
        if (typeof updateCartCount === 'function') {
          updateCartCount();
        }
      });

    fetch('./components/cart-panel.html')
      .then(response => response.text())
      .then(html => {
        document.getElementById('cart-panel-container').innerHTML = html;
      });
  }

  function renderHomePage() {
    setText('stat-categories', String(catalog.categories.length));
    setText('stat-products', String(catalog.products.length));

    const note = document.getElementById('catalog-note');
    if (note) {
      note.textContent = catalog.generatedAt
        ? `Catalog generated ${new Date(catalog.generatedAt).toLocaleString('en-IN')}.`
        : 'Catalog loaded from bundled sample data.';
    }

    renderCategoryTiles('home-category-links');
    renderCategoryLinks('category-nav');
    renderAllSections('collection-sections', homeState.searchTerm);
    renderSourcePanel('source-panel');
    updateHomeSearchStatus();
    bindHomeSearch();
  }

  function renderCategoryPage(categoryId) {
    const category = getCategory(categoryId);
    const products = getProducts(categoryId);
    if (!category) return;

    document.title = `Reyval | ${category.label}`;
    setText('hero-category-title', `${category.label} Collection`);
    setText('hero-category-copy', `Discover Reyval's ${category.label.toLowerCase()} edit with premium storytelling, polished product cards, and a focused luxury browsing experience.`);
    setText('category-count', `${products.length} curated products`);
    setText('section-category-title', category.label);
    setText('section-category-copy', category.blurb);

    renderCategoryLinks('category-nav', categoryId);
    renderSourcePanel('source-panel');

    const grid = document.getElementById('category-grid');
    if (grid) {
      grid.innerHTML = products.map(buildCard).join('');
    }
  }

  window.addItemToBag = (itemId) => {
    const product = productIndex.get(itemId);
    if (!product) return;
    addToCart(product.name, product.price, product.id);
    if (typeof updateCartDisplay === 'function') {
      updateCartDisplay();
    }
  };

  window.ReyvalStorefront = {
    catalog,
    hydrateChrome,
    applyCatalogSearch,
    renderHomePage,
    renderCategoryPage
  };
})();
