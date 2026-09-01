// ==========================================
// AUTENTICAÇÃO E CONFIGURAÇÕES GLOBAIS
// ==========================================
const ADMIN_SESSION_KEY  = "gs2_admin_authenticated";
const DEFAULT_ADMIN_PASS = "gs2admin";
const WHOLESALE_SESSION_KEY = "gs2_wholesale_authenticated";
const DEFAULT_WHOLESALE_PASS = "gs2atacado";
const WHATSAPP_NUMBER    = "5547988614670";
const BRANDS_KEY         = "gs2_brands";
const CATEGORIES_KEY     = "gs2_categories";

// Senha salva no Supabase para sincronizar entre dispositivos
async function getStoredPassword() {
  try {
    const { data, error } = await sbClient.from('settings').select('value').eq('key', 'admin_password').single();
    if (error || !data) return DEFAULT_ADMIN_PASS;
    return data.value;
  } catch { return DEFAULT_ADMIN_PASS; }
}

async function savePasswordToCloud(newPass) {
  await sbClient.from('settings').upsert({ key: 'admin_password', value: newPass }, { onConflict: 'key' });
}

let allProducts = [], filteredProducts = [], selectedBrand = "", selectedCategory = "";
let cart = [];
let globalPriceHistory = {}; // Armazena histórico de compras/preços

let saleSimulation = new Map();
let saleSimulationSearch = "";
let currentCategory = "all", currentGender = "all", currentBrand = "all", currentAvailability = "all", currentSearch = "", currentSort = "default";
let adminSortCol = null, adminSortDir = "asc", uploadedImageFile = null, currentPreviewUrl = null;
let catalogSortCol = null, catalogSortDir = "asc";
let adminAvailabilityFilter = "all", adminSearchQuery = "";
let editingProductId = null;
const objectUrlCache = new Map();

function isAdminAuthenticated() { return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true"; }
async function loginAdmin(password) {
  const storedPass = await getStoredPassword();
  if (password === storedPass) { sessionStorage.setItem(ADMIN_SESSION_KEY, "true"); return true; }
  return false;
}
function logoutAdmin() { sessionStorage.removeItem(ADMIN_SESSION_KEY); }

function isWholesaleAuthenticated() { return sessionStorage.getItem(WHOLESALE_SESSION_KEY) === "true"; }
function loginWholesale(password) {
  if (password === DEFAULT_WHOLESALE_PASS) { sessionStorage.setItem(WHOLESALE_SESSION_KEY, "true"); return true; }
  return false;
}
function logoutWholesale() { sessionStorage.removeItem(WHOLESALE_SESSION_KEY); }

// ==========================================
// GERENCIAMENTO DE MARCAS E CATEGORIAS
// ==========================================
function getBrands() { try { return JSON.parse(localStorage.getItem(BRANDS_KEY) || "[]"); } catch { return []; } }
function saveBrands(brands) { localStorage.setItem(BRANDS_KEY, JSON.stringify(brands)); }
function getCategoryList() { try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]"); } catch { return []; } }
function saveCategoryList(cats) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats)); }

// ==========================================
// HISTÓRICO E RANKING DE COMPRAS
// ==========================================
async function loadPriceHistory() {
  try {
    const { data, error } = await sbClient.from('settings').select('value').eq('key', 'price_history').single();
    if (!error && data && data.value) {
      globalPriceHistory = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    }
  } catch (e) {
    const local = localStorage.getItem('gs2_price_history');
    if (local) globalPriceHistory = JSON.parse(local);
  }
}

async function savePriceHistoryToCloud() {
  try {
    localStorage.setItem('gs2_price_history', JSON.stringify(globalPriceHistory));
    await sbClient.from('settings').upsert({ key: 'price_history', value: JSON.stringify(globalPriceHistory) }, { onConflict: 'key' });
  } catch (e) {
    console.error('Erro ao salvar histórico', e);
  }
}

function addPriceToHistory(productId, price, quantityAdded) {
  if (!productId) return false;
  if (!globalPriceHistory[productId]) {
    globalPriceHistory[productId] = [];
  }
  const history = globalPriceHistory[productId];
  const today = new Date().toISOString().split('T')[0];

  // Verifica se já tem uma entrada exatamente no mesmo dia com a mesma quantidade e preço
  // para evitar duplicatas, embora qtyAdded deva acumular.
  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    if (lastEntry.date === today && lastEntry.price === price && lastEntry.quantityAdded === quantityAdded) return false;
  }

  history.push({ date: today, price: price, quantityAdded: quantityAdded });
  savePriceHistoryToCloud();
  return true;
}

function openPriceHistoryModal(productId) {
  const history = globalPriceHistory[productId] || [];
  const container = document.getElementById("price-history-content");
  container.innerHTML = "";

  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 2rem 0;"><p>Nenhum registro de compra.</p></div>`;
  } else {
    // Reverse order to show newest first
    [...history].reverse().forEach(entry => {
      const dateParts = entry.date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : entry.date;
      const div = document.createElement("div");
      div.className = "history-entry";
      div.innerHTML = `
        <div>
          <div class="history-entry-date">${formattedDate}</div>
          <div class="history-entry-price">${formatBRL(entry.price || 0)}</div>
        </div>
        ${entry.quantityAdded > 0 ? `<div class="history-entry-qty">+${entry.quantityAdded} itens</div>` : ''}
      `;
      container.appendChild(div);
    });
  }
  document.getElementById("price-history-modal").classList.add("active");
}

function openTopSellersModal() {
  const container = document.getElementById("top-sellers-content");
  container.innerHTML = "";

  // Calcula o ranking com base no número de vezes que o produto teve entrada ou alteração de preço
  let ranking = [];
  Object.keys(globalPriceHistory).forEach(productId => {
    const history = globalPriceHistory[productId];
    let totalPurchased = history.length;

    if (totalPurchased > 0) {
      const product = allProducts.find(p => String(p.id) === String(productId));
      if (product) {
        ranking.push({ product, score: totalPurchased });
      }
    }
  });

  ranking.sort((a, b) => b.score - a.score); // Maior para menor

  if (ranking.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 2.5rem 1rem;"><p>Não há histórico de reposições de estoque para gerar o ranking ainda.</p></div>`;
  } else {
    ranking.forEach((item, index) => {
      const p = item.product;
      const catBrand = [p.category, p.brand].filter(Boolean).join(" · ");
      const div = document.createElement("div");
      div.className = "top-seller-card";
      
      let rankColor = "#f59e0b"; // Ouro
      if (index === 1) rankColor = "#94a3b8"; // Prata
      else if (index === 2) rankColor = "#b45309"; // Bronze
      else if (index > 2) rankColor = "var(--text-muted)";

      div.innerHTML = `
        <div class="top-seller-rank" style="color: ${rankColor}">${index + 1}º</div>
        <img src="${p.image}" class="top-seller-thumb" alt="${p.name}">
        <div class="top-seller-info">
          <div class="top-seller-title">${p.name}</div>
          <div class="top-seller-meta">${catBrand || "Sem Categoria"}</div>
        </div>
        <div class="top-seller-score">
          <div class="top-seller-score-val">${item.score}</div>
          <div class="top-seller-score-lbl">Repostos</div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  document.getElementById("top-sellers-modal").classList.add("active");
}


function renderBrandButtons() {
  const container = document.getElementById("brand-chips-container");
  if (!container) return;
  const brands = getBrands();
  container.innerHTML = brands.length === 0 ? '<span class="brand-placeholder">Nenhuma marca cadastrada</span>' : "";
  brands.forEach(brand => {
    const chip = document.createElement("div");
    chip.className = "brand-chip" + (selectedBrand === brand ? " selected" : "");
    chip.innerHTML = `<span>${brand}</span><button type="button" class="brand-delete-btn" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;color:inherit;opacity:0.65;font-size:1rem;line-height:1;">×</button>`;
    chip.querySelector("span").onclick = () => { selectedBrand = (selectedBrand === brand) ? "" : brand; renderBrandButtons(); document.getElementById("product-brand").value = selectedBrand; };
    chip.querySelector("button").onclick = (e) => { e.stopPropagation(); saveBrands(getBrands().filter(b => b !== brand)); renderBrandButtons(); };
    container.appendChild(chip);
  });
}

function renderCategoryChips() {
  const container = document.getElementById("category-chips-container");
  if (!container) return;
  const cats = getCategoryList();
  const sel = document.getElementById("product-category");
  container.innerHTML = cats.length === 0 ? '<span class="brand-placeholder">Nenhuma categoria cadastrada</span>' : "";
  cats.forEach(cat => {
    const chip = document.createElement("div");
    chip.className = "brand-chip" + (selectedCategory === cat ? " selected" : "");
    chip.innerHTML = `<span>${cat}</span><button type="button" class="brand-delete-btn" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;color:inherit;opacity:0.65;font-size:1rem;line-height:1;">×</button>`;
    chip.querySelector("span").onclick = () => { selectedCategory = (selectedCategory === cat) ? "" : cat; sel.value = selectedCategory; renderCategoryChips(); updateGenderVisibility(); };
    chip.querySelector("button").onclick = (e) => { e.stopPropagation(); saveCategoryList(getCategoryList().filter(c => c !== cat)); renderCategoryChips(); updateGenderVisibility(); };
    container.appendChild(chip);
  });
}

function updateGenderVisibility() {
  const genderGroup = document.getElementById("form-group-gender");
  if (!genderGroup) return;
  if (!selectedCategory || selectedCategory.toLowerCase().includes("perfume")) {
    genderGroup.style.display = "block";
  } else {
    genderGroup.style.display = "none";
    document.getElementById("product-gender").value = "";
    document.getElementById("btn-gender-masc").classList.remove("active");
    document.getElementById("btn-gender-fem").classList.remove("active");
  }
}

function renderCategoryTabs() {
  // Filtro de categorias removido (agora exibe sempre "Todos" por padrão)
}

function renderGenderTabs() {
  const tabs = document.getElementById("gender-tabs");
  if (!tabs) return;
  // Apenas mostrar genêro se existirem produtos com gênero
  const hasGendered = allProducts.some(p => p.gender);
  tabs.style.display = hasGendered ? "" : "none";
  if (!hasGendered) return;
  const genders = [
    { id: "all", label: "Todos" },
    { id: "Masculino", label: "Masculino" },
    { id: "Feminino", label: "Feminino" }
  ];
  tabs.innerHTML = "";
  genders.forEach(gen => {
    const btn = document.createElement("button");
    btn.className = `filter-chip ${currentGender === gen.id ? "active" : ""}`;
    btn.textContent = gen.label;
    btn.onclick = () => { currentGender = gen.id; applyFiltersAndRender(); };
    tabs.appendChild(btn);
  });
}

function renderBrandFilterTabs() {
  const select = document.getElementById("brand-select");
  if (!select) return;
  if (select.options.length > 1) return; // Já populado
  
  const uniqueBrands = [...new Set(allProducts.map(p => p.brand?.trim()).filter(Boolean))].sort();
  if (uniqueBrands.length === 0) { select.style.display = "none"; return; }
  
  select.style.display = "";
  uniqueBrands.forEach(brand => {
    const opt = document.createElement("option");
    opt.value = brand;
    opt.textContent = brand;
    select.appendChild(opt);
  });
}


// ==========================================
// RENDERIZAÇÃO E FILTRAGEM
// ==========================================
async function loadProductsData() {
  try {
    allProducts = await CatalogDB.getAll();
    applyFiltersAndRender();
  } catch (error) { console.error("Erro ao carregar:", error); }
}

let currentCatalogLayout = "grid";

function applyFiltersAndRender() {
  filteredProducts = allProducts.filter(p =>
    (currentCategory === "all" || p.category.toLowerCase() === currentCategory.toLowerCase()) &&
    (currentGender === "all" || (p.gender || "") === currentGender) &&
    (currentBrand === "all" || (p.brand || "") === currentBrand) &&
    (currentAvailability === "all" || (currentAvailability === "available" ? !p.unavailable : p.unavailable)) &&
    (currentSearch === "" || p.name.toLowerCase().includes(currentSearch.toLowerCase()))
  );

  if (catalogSortCol) {
    filteredProducts.sort((a, b) => {
      let va = a[catalogSortCol];
      let vb = b[catalogSortCol];
      if (va === undefined || va === null) va = "";
      if (vb === undefined || vb === null) vb = "";
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return catalogSortDir === "asc" ? -1 : 1;
      if (va > vb) return catalogSortDir === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    if (currentSort === "price-asc") filteredProducts.sort((a, b) => a.priceWholesale - b.priceWholesale);
    else if (currentSort === "price-desc") filteredProducts.sort((a, b) => b.priceWholesale - a.priceWholesale);
    else if (currentSort === "name-asc") filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
    else if (currentSort === "name-desc") filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
  }

  const isWholesale = isWholesaleAuthenticated();
  const productGrid = document.getElementById("product-grid");
  const productListView = document.getElementById("product-list-view");

  // Sempre renderizamos ambos, pois no mobile o CSS (display: grid !important) pode forçar a exibição do grid
  // mesmo quando o layout atual é "list", garantindo assim que os preços estejam sempre atualizados.
  renderCatalogGrid();
  renderCatalogList();

  if (currentCatalogLayout === "list") {
    if (productGrid) productGrid.style.display = "none";
    if (productListView) productListView.style.display = "block";
  } else {
    if (productGrid) productGrid.style.display = "grid";
    if (productListView) productListView.style.display = "none";
  }

  renderCategoryTabs();
  renderGenderTabs();
  renderBrandFilterTabs();

  // Mostrar/ocultar botão "Gerar Tabela Atacado" com base na autenticação
  const btnWholesaleShare = document.getElementById("btn-wholesale-share-list");
  if (btnWholesaleShare) {
    btnWholesaleShare.style.display = isWholesale ? "inline-flex" : "none";
  }

  if (document.getElementById("admin-view").style.display !== "none") renderAdminProductsList();
}


function formatBRL(val) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function renderCatalogGrid() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = filteredProducts.length === 0
    ? '<div class="empty-state"><i data-lucide="package-open" style="width:48px;height:48px;"></i><p>Nenhum produto encontrado.</p></div>'
    : "";

  const isWholesale = isWholesaleAuthenticated();
  const announcementBar = document.querySelector(".announcement-bar");
  if (announcementBar) {
    if (isWholesale) {
      announcementBar.innerHTML = "✨ ÁREA DE ATACADO ATIVA — PREÇOS EXCLUSIVOS PARA REVENDA";
      announcementBar.style.background = "linear-gradient(90deg, #800020, #5c021a, #800020)";
      announcementBar.style.color = "#ffffff";
    } else {
      announcementBar.innerHTML = "✨ GS2 IMPORTS — PERFUMES IMPORTADOS E ELETRÔNICOS PREMIUM";
      announcementBar.style.background = "#0d0d0f";
      announcementBar.style.color = "#e5c158";
    }
  }

  filteredProducts.forEach(product => {
    const price = isWholesale ? product.priceWholesale : product.priceSuggested;
    const card = document.createElement("div");
    card.className = "pcard" + (product.unavailable ? " pcard--unavailable" : "");
    card.onclick = () => openProductDetails(product.id);
    card.innerHTML = `
      <div class="pcard-image-area">
        <img src="${product.image}" alt="${product.name}" class="pcard-image">
        ${product.unavailable ? '<div class="pcard-unavail">Esgotado</div>' : ""}
        ${product.gender ? `<span class="pcard-gender-badge pcard-gender-badge--${product.gender === 'Masculino' ? 'masc' : 'fem'}">${product.gender === 'Masculino' ? '♂' : '♀'}</span>` : ""}
      </div>
      <div class="pcard-body">
        <p class="pcard-name">${product.name}</p>
        <p class="pcard-sub">${[product.category, product.brand].filter(Boolean).join(' · ')}</p>
        <div class="pcard-footer">
          <span class="pcard-price">${formatBRL(price)}</span>
          <button class="pcard-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}', 1)" title="Adicionar ao pedido">
            <i data-lucide="shopping-bag" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  lucide.createIcons();
}

function renderCatalogList() {
  const list = document.getElementById("wholesale-products-list");
  if (!list) return;
  list.innerHTML = "";

  const isWholesale = isWholesaleAuthenticated();

  if (filteredProducts.length === 0) {
    list.innerHTML = `<div class="empty-state"><i data-lucide="package-open" style="width:48px;height:48px;"></i><p>Nenhum produto encontrado.</p></div>`;
    lucide.createIcons();
    return;
  }

  if (isWholesale) {
    // ── MODO ATACADO: Tabela detalhada estilo admin ──
    const tableWrap = document.createElement("div");
    tableWrap.className = "admin-table-container";
    const table = document.createElement("table");
    table.className = "admin-table wholesale-catalog-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Foto</th>
          <th class="catalog-th-sort" data-sort="name" style="cursor:pointer; user-select:none;">Nome <span class="sort-icon">${catalogSortCol === 'name' ? (catalogSortDir === 'asc' ? '▲' : '▼') : '↕'}</span></th>
          <th class="catalog-th-sort" data-sort="category" style="cursor:pointer; user-select:none;">Categoria <span class="sort-icon">${catalogSortCol === 'category' ? (catalogSortDir === 'asc' ? '▲' : '▼') : '↕'}</span></th>
          <th class="catalog-th-sort" data-sort="priceWholesale" style="cursor:pointer; user-select:none;">Valor Atacado <span class="sort-icon">${catalogSortCol === 'priceWholesale' ? (catalogSortDir === 'asc' ? '▲' : '▼') : '↕'}</span></th>
          <th class="catalog-th-sort" data-sort="quantity" style="cursor:pointer; user-select:none;">Qtd. <span class="sort-icon">${catalogSortCol === 'quantity' ? (catalogSortDir === 'asc' ? '▲' : '▼') : '↕'}</span></th>
          <th>Ação</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement("tbody");

    filteredProducts.forEach(product => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.onclick = () => openProductDetails(product.id);
      if (product.unavailable) tr.classList.add("wholesale-row-unavailable");
      tr.innerHTML = `
        <td><img class="admin-prod-thumb" src="${product.image}" alt="${product.name}"></td>
        <td style="font-weight:600;">${product.name}${product.unavailable ? ' <span class="wholesale-unavail-tag">Esgotado</span>' : ''}</td>
        <td>${product.category || '—'}</td>
        <td style="font-weight:700;">${formatBRL(product.priceWholesale)}</td>
        <td>${product.quantity || 0}</td>
        <td>
          <button class="hcard-btn" onclick="event.stopPropagation(); addToCart('${product.id}', 1)" ${product.unavailable ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
            <i data-lucide="shopping-bag" style="width:13px;height:13px;"></i> Adicionar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    list.appendChild(tableWrap);

    // Adiciona evento de clique para ordenação
    table.querySelectorAll(".catalog-th-sort").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (catalogSortCol === col) {
          catalogSortDir = catalogSortDir === "asc" ? "desc" : "asc";
        } else {
          catalogSortCol = col;
          catalogSortDir = "asc";
        }
        
        // Reseta o select do filtro para "default"
        const sortSelect = document.getElementById("sort-select");
        if (sortSelect) sortSelect.value = "default";
        currentSort = "default";

        applyFiltersAndRender();
      });
    });
  } else {
    // ── MODO PADRÃO: Cards horizontais ──
    const header = document.createElement("div");
    header.className = "hcard-header";
    header.innerHTML = `
      <span></span>
      <span>Produto</span>
      <span>Categoria · Marca</span>
      <span>Valor</span>
      <span>Ação</span>
    `;
    list.appendChild(header);

    filteredProducts.forEach(product => {
      const price = product.priceSuggested;
      const subText = [product.category, product.brand].filter(Boolean).join(" · ");
      const genderText = product.gender ? ` · ${product.gender}` : "";

      const card = document.createElement("div");
      card.className = "hcard" + (product.unavailable ? " hcard--unavailable" : "");
      card.onclick = () => openProductDetails(product.id);
      card.innerHTML = `
        <div class="hcard-image-wrap">
          <img src="${product.image}" alt="${product.name}" class="hcard-image">
          ${product.unavailable ? '<div class="hcard-unavail-badge">Esgotado</div>' : ""}
        </div>
        <div class="hcard-body">
          <div class="hcard-title">${product.name}</div>
        </div>
        <div class="hcard-meta">
          <span class="hcard-tag">${subText || "—"}${genderText}</span>
        </div>
        <div class="hcard-price" style="color:#0066cc;">${formatBRL(price)}</div>
        <div>
          <button class="hcard-btn" onclick="event.stopPropagation(); addToCart('${product.id}', 1)">
            <i data-lucide="shopping-bag" style="width:13px;height:13px;"></i> Adicionar
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  }
  lucide.createIcons();
}


// ==========================================
// CÁLCULO DE LUCRO (FORMULÁRIO)
// ==========================================
function updateProfitDisplay() {
  const purchasePrice = parseFloat(document.getElementById("product-price-last-purchase").value) || 0;
  const suggestedPrice = parseFloat(document.getElementById("product-price-suggested").value) || 0;
  const profit = suggestedPrice - purchasePrice;
  const profitPercent = purchasePrice > 0 ? ((profit / purchasePrice) * 100).toFixed(0) : 0;

  const valueEl = document.getElementById("profit-value-display");
  const percentEl = document.getElementById("profit-percent-display");
  const boxEl = document.getElementById("profit-display-box");

  if (!valueEl || !percentEl || !boxEl) return;

  valueEl.textContent = formatBRL(profit);
  percentEl.textContent = purchasePrice > 0 ? `${profitPercent}%` : '—';

  boxEl.classList.remove("profit-positive", "profit-negative", "profit-zero");
  if (purchasePrice <= 0 || suggestedPrice <= 0) {
    boxEl.classList.add("profit-zero");
  } else if (profit > 0) {
    boxEl.classList.add("profit-positive");
  } else if (profit < 0) {
    boxEl.classList.add("profit-negative");
  } else {
    boxEl.classList.add("profit-zero");
  }
}

function renderAdminKPIs() {
  const kpiGrid = document.getElementById("admin-kpi-grid");
  if (!kpiGrid) return;

  let totalQty = 0;
  let totalProducts = allProducts.length;
  let totalLastPurchase = 0;
  let totalWholesale = 0;
  let totalRetail = 0;

  allProducts.forEach(p => {
    const qty = parseInt(p.quantity) || 0;
    const priceLast = (p.priceLastPurchase !== null && p.priceLastPurchase !== undefined && p.priceLastPurchase !== "") 
      ? parseFloat(p.priceLastPurchase) || 0 
      : parseFloat(p.priceWholesale) || 0;
    const priceWholesale = parseFloat(p.priceWholesale) || 0;
    const priceSuggested = parseFloat(p.priceSuggested) || 0;

    totalQty += qty;
    totalLastPurchase += qty * priceLast;
    totalWholesale += qty * priceWholesale;
    totalRetail += qty * priceSuggested;
  });

  const totalProfit = totalRetail - totalWholesale;
  const marginPercent = totalWholesale > 0 ? ((totalProfit / totalWholesale) * 100).toFixed(1) : 0;

  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-card-header">
        <span class="kpi-label">Total em Estoque</span>
        <div class="kpi-icon-wrap"><i data-lucide="package"></i></div>
      </div>
      <div class="kpi-value">${totalQty} <span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">un.</span></div>
      <div class="kpi-subtext"><span class="kpi-badge kpi-badge-gold">${totalProducts} produtos</span> cadastrados</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-card-header">
        <span class="kpi-label">ÚÚltima Compra Total</span>
        <div class="kpi-icon-wrap"><i data-lucide="shopping-bag"></i></div>
      </div>
      <div class="kpi-value">${formatBRL(totalLastPurchase)}</div>
      <div class="kpi-subtext">Custo pago na última compra</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-card-header">
        <span class="kpi-label">Atacado Total (Custo)</span>
        <div class="kpi-icon-wrap"><i data-lucide="tag"></i></div>
      </div>
      <div class="kpi-value">${formatBRL(totalWholesale)}</div>
      <div class="kpi-subtext">Valor de reposição atual</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-card-header">
        <span class="kpi-label">Venda Total (Sugerido)</span>
        <div class="kpi-icon-wrap" style="background: rgba(34, 197, 94, 0.1); color: #4ade80;"><i data-lucide="dollar-sign"></i></div>
      </div>
      <div class="kpi-value" style="color: #4ade80;">${formatBRL(totalRetail)}</div>
      <div class="kpi-subtext">Valor total potencial</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-card-header">
        <span class="kpi-label">Lucro Estimado</span>
        <div class="kpi-icon-wrap" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa;"><i data-lucide="trending-up"></i></div>
      </div>
      <div class="kpi-value" style="color: #60a5fa;">${formatBRL(totalProfit)}</div>
      <div class="kpi-subtext"><span class="kpi-badge kpi-badge-blue">+${marginPercent}%</span> sobre o atacado</div>
    </div>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderAdminProductsList() {
  renderAdminKPIs();
  const list = document.getElementById("admin-products-list");
  if (!list) return;
  list.innerHTML = "";

  let filtered = allProducts.filter(p => {
    // Busca por termo no admin
    if (adminSearchQuery) {
      const q = adminSearchQuery.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCat = (p.category || "").toLowerCase().includes(q);
      const matchBrand = (p.brand || "").toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchBrand) return false;
    }

    // Filtro de Disponibilidade / Estoque
    const isOutOfStock = p.unavailable || (parseInt(p.quantity) || 0) <= 0;
    if (adminAvailabilityFilter === "available" && isOutOfStock) return false;
    if (adminAvailabilityFilter === "unavailable" && !isOutOfStock) return false;

    return true;
  });

  if (adminSortCol) {
    filtered.sort((a, b) => {
      let va, vb;
      if (adminSortCol === "profit") {
        va = (a.priceSuggested || 0) - (a.priceLastPurchase || 0);
        vb = (b.priceSuggested || 0) - (b.priceLastPurchase || 0);
      } else {
        va = a[adminSortCol]; vb = b[adminSortCol];
      }
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return adminSortDir === "asc" ? -1 : 1;
      if (va > vb) return adminSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  if (filtered.length === 0) {
    list.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted); font-size:0.9rem;">Nenhum produto encontrado com os filtros selecionados.</td></tr>`;
    return;
  }

  filtered.forEach(product => {
    const profit = (product.priceSuggested || 0) - (product.priceLastPurchase || 0);
    const profitPercent = product.priceLastPurchase > 0 ? ((profit / product.priceLastPurchase) * 100).toFixed(0) : null;
    const hasPurchase = product.priceLastPurchase > 0;
    const profitClass = hasPurchase ? (profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : '') : '';
    const isOutOfStock = product.unavailable || (parseInt(product.quantity) || 0) <= 0;

    const tr = document.createElement("tr");
    if (product.inTransit) tr.style.background = "rgba(251, 146, 60, 0.06)";
    else if (isOutOfStock) tr.style.background = "rgba(239, 68, 68, 0.03)";
    tr.innerHTML = `
      <td><img class="admin-prod-thumb" src="${product.image}" alt="${product.name}"></td>
      <td style="font-weight:600;">${product.name}${isOutOfStock && !product.inTransit ? ' <span class="wholesale-unavail-tag">Sem Estoque</span>' : ''}${product.inTransit ? ' <span class="transit-tag">Em Trânsito</span>' : ''}</td>
      <td>${product.category || '—'}</td>
      <td>${hasPurchase ? formatBRL(product.priceLastPurchase) : '—'}</td>
      <td>${formatBRL(product.priceWholesale)}</td>
      <td>${formatBRL(product.priceSuggested)}</td>
      <td class="admin-profit-cell ${profitClass}">
        ${hasPurchase ? `<span class="admin-profit-value">${formatBRL(profit)}</span><span class="admin-profit-percent">${profitPercent}%</span>` : '—'}
      </td>
      <td style="font-weight:700; ${isOutOfStock && !product.inTransit ? 'color: var(--danger);' : product.inTransit ? 'color: #f97316;' : ''}">${product.quantity || 0}</td>
      <td>
        <div class="admin-actions">
          <button class="btn-icon-only" title="Editar" onclick="openProductForm('${product.id}')"><i data-lucide="edit-2" style="width:15px;height:15px;"></i></button>
          <button class="btn-icon-only" title="${product.unavailable ? 'Marcar como Disponível' : 'Marcar como Sem Estoque'}" onclick="handleToggleAvailability('${product.id}')" style="${product.unavailable ? 'background: rgba(224, 92, 92, 0.25); border-color: var(--danger); color: var(--danger);' : ''}">
            <i data-lucide="${product.unavailable ? 'eye-off' : 'eye'}" style="width:15px;height:15px;"></i>
          </button>
          <button class="btn-icon-only btn-transit" title="${product.inTransit ? 'Cancelar Trânsito' : 'Marcar como Em Trânsito'}" onclick="handleToggleTransit('${product.id}')" style="${product.inTransit ? 'background: rgba(251, 146, 60, 0.25); border-color: #f97316; color: #f97316;' : ''}">
            <i data-lucide="truck" style="width:15px;height:15px;"></i>
          </button>
          <button class="btn-icon-only btn-delete" title="Excluir" onclick="handleDeleteProduct('${product.id}')"><i data-lucide="trash-2" style="width:15px;height:15px;"></i></button>
        </div>
      </td>
    `;
    list.appendChild(tr);
  });
  lucide.createIcons();
}

// ==========================================
// GERADOR DE LISTA DE COMPRAS (PRODUTOS EM FALTA)
// ==========================================
function getOutOfStockProducts() {
  return allProducts
    .filter(p => (p.unavailable || (parseInt(p.quantity) || 0) <= 0) && !p.inTransit)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));
}

function openShoppingListModal() {
  const modal = document.getElementById("shopping-list-modal");
  const content = document.getElementById("shopping-list-content");
  const summary = document.getElementById("shopping-list-summary");
  if (!modal || !content) return;

  const outOfStock = getOutOfStockProducts(); // já em A-Z
  content.innerHTML = "";

  if (outOfStock.length === 0) {
    content.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <i data-lucide="check-circle-2" style="width:52px;height:52px; color: #25d366;"></i>
        <p style="font-weight:700; font-size: 1rem;">Todos os produtos estão em estoque!</p>
        <span style="font-size:0.8rem; color: var(--text-muted);">Não há nenhum item marcado como esgotado ou com quantidade zero.</span>
      </div>
    `;
    if (summary) summary.textContent = "0 itens a repor";
  } else {
    if (summary) summary.textContent = `${outOfStock.length} ${outOfStock.length === 1 ? "item" : "itens"} a repor no estoque (A-Z)`;

    outOfStock.forEach(product => {
      const card = document.createElement("div");
      card.className = "shopping-list-card";
      const catBrand = [product.category, product.brand].filter(Boolean).join(" · ");
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="shopping-list-thumb">
        <div class="shopping-list-info">
          <div class="shopping-list-title">${product.name}</div>
          <div class="shopping-list-meta">${catBrand || "Sem categoria"}</div>
        </div>
        <div class="shopping-list-prices">
          ${product.priceLastPurchase > 0 ? `<div class="shopping-list-price-last">Últ. Compra: ${formatBRL(product.priceLastPurchase)}</div>` : ""}
          <span class="shopping-list-badge">Em falta</span>
        </div>
      `;
      content.appendChild(card);
    });
  }

  lucide.createIcons();
  modal.classList.add("active");
}

function generateShoppingListText() {
  const outOfStock = getOutOfStockProducts(); // já em A-Z
  if (outOfStock.length === 0) return "Todos os produtos do catálogo estão em estoque!";

  let text = `📋 *LISTA DE COMPRAS — GS2 IMPORTS*\n`;
  text += `────────────────────────────────\n`;
  outOfStock.forEach((p, idx) => {
    text += `${idx + 1}. ${p.name}\n`;
  });
  return text.trim();
}

function copyShoppingList() {
  const text = generateShoppingListText();
  navigator.clipboard.writeText(text).then(() => {
    showToast("Lista de compras copiada para a área de transferência!");
  }).catch(err => {
    console.error("Erro ao copiar:", err);
    showToast("Erro ao copiar lista de compras.", true);
  });
}

function sendShoppingListWhatsApp() {
  const text = generateShoppingListText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

// ==========================================
// GERADOR DE TABELA DE ATACADO (LISTA MODAL)
// ==========================================
function getAvailableWholesaleProducts() {
  return allProducts
    .filter(p => !p.unavailable && (parseInt(p.quantity) || 0) > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));
}

function openWholesaleListModal() {
  const modal = document.getElementById("wholesale-list-modal");
  const content = document.getElementById("wholesale-list-content");
  const summary = document.getElementById("wholesale-list-summary");
  if (!modal || !content) return;

  const products = getAvailableWholesaleProducts(); // já em A-Z
  content.innerHTML = "";

  if (products.length === 0) {
    content.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <i data-lucide="package-open" style="width:52px;height:52px; opacity:0.4;"></i>
        <p style="font-weight:700; font-size: 1rem;">Nenhum produto disponível no momento.</p>
      </div>
    `;
    if (summary) summary.textContent = "0 produtos no atacado";
  } else {
    if (summary) summary.textContent = `${products.length} produto(s) disponíveis — ordem A-Z`;

    products.forEach(product => {
      const card = document.createElement("div");
      card.className = "wholesale-list-card";
      const catBrand = [product.category, product.brand].filter(Boolean).join(" · ");
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="wholesale-list-thumb">
        <div class="wholesale-list-info">
          <div class="wholesale-list-title">${product.name}</div>
          <div class="wholesale-list-meta">${catBrand || "Sem categoria"}</div>
        </div>
        <div class="wholesale-list-price">${formatBRL(product.priceWholesale)}</div>
      `;
      content.appendChild(card);
    });
  }

  lucide.createIcons();
  modal.classList.add("active");
}

function generateWholesaleListText() {
  const products = getAvailableWholesaleProducts(); // já em A-Z
  if (products.length === 0) return "Nenhum produto disponível no momento.";

  const today = new Date().toLocaleDateString("pt-BR");
  let text = `💛 *TABELA DE ATACADO — GS2 IMPORTS*\n`;
  text += `📅 ${today}\n`;
  text += `────────────────────────────────\n`;
  products.forEach((p, idx) => {
    const meta = [p.category, p.brand].filter(Boolean).join(" · ");
    text += `${idx + 1}. *${p.name}*${meta ? ` [${meta}]` : ""} — *${formatBRL(p.priceWholesale)}*\n`;
  });
  text += `────────────────────────────────\n`;
  text += `📦 *Total de itens disponíveis:* ${products.length} produto(s)\n`;
  text += `📲 _GS2 Imports — Contato: wa.me/${WHATSAPP_NUMBER}_`;
  return text;
}

function copyWholesaleList() {
  const text = generateWholesaleListText();
  navigator.clipboard.writeText(text).then(() => {
    showToast("Tabela de atacado copiada para a área de transferência!");
  }).catch(err => {
    console.error("Erro ao copiar:", err);
    showToast("Erro ao copiar tabela de atacado.", true);
  });
}

function sendWholesaleListWhatsApp() {
  const text = generateWholesaleListText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}


// ==========================================
// SIMULADOR DE VENDA E LUCRO (ADMIN)
// ==========================================
function getSaleSimulationItems() {
  return [...saleSimulation.entries()]
    .map(([productId, quantity]) => {
      const product = allProducts.find(p => String(p.id) === String(productId));
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
}

function openSaleSimulator() {
  saleSimulationSearch = "";
  const search = document.getElementById("sale-simulator-search");
  if (search) search.value = "";
  renderSaleSimulatorProducts();
  document.getElementById("sale-simulator-modal")?.classList.add("active");
}

function updateSaleSimulatorRowState(productId) {
  const quantity = saleSimulation.get(String(productId)) || 0;
  const button = document.querySelector(`.sale-add-btn[data-product-id="${productId}"]`);
  if (!button) return;
  button.classList.toggle("added", quantity > 0);
  button.innerHTML = quantity > 0
    ? '<i data-lucide="check" style="width:14px;height:14px;"></i><span>Adicionado</span>'
    : '<i data-lucide="plus" style="width:14px;height:14px;"></i><span>Adicionar</span>';
  lucide.createIcons();
}

function addSaleSimulationProduct(productId) {
  const key = String(productId);
  if (!saleSimulation.has(key)) saleSimulation.set(key, 1);

  const input = document.querySelector(`.sale-qty-input[data-product-id="${productId}"]`);
  if (input) input.value = saleSimulation.get(key);

  updateSaleSimulatorRowState(productId);
  updateSaleSimulatorSummary();
}

function setSaleSimulationQuantity(productId, value) {
  const quantity = Math.max(0, parseInt(value, 10) || 0);
  if (quantity === 0) saleSimulation.delete(String(productId));
  else saleSimulation.set(String(productId), quantity);
  updateSaleSimulatorRowState(productId);
  updateSaleSimulatorSummary();
}

function renderSaleSimulatorProducts() {
  const tbody = document.getElementById("sale-simulator-products");
  if (!tbody) return;
  const q = saleSimulationSearch.trim().toLowerCase();
  const products = allProducts
    .filter(p => !q || (p.name || "").toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));

  tbody.innerHTML = "";
  products.forEach(product => {
    const qty = saleSimulation.get(String(product.id)) || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="sale-product-cell">
          <img src="${product.image}" alt="${product.name}">
          <div><strong>${product.name}</strong><small>${[product.category, product.brand].filter(Boolean).join(" · ")}</small></div>
        </div>
      </td>
      <td>
        <button type="button" class="sale-add-btn${qty > 0 ? ' added' : ''}" data-product-id="${product.id}">
          <i data-lucide="${qty > 0 ? 'check' : 'plus'}" style="width:14px;height:14px;"></i>
          <span>${qty > 0 ? 'Adicionado' : 'Adicionar'}</span>
        </button>
      </td>
      <td>${formatBRL(product.priceLastPurchase || 0)}</td>
      <td>${formatBRL(product.priceWholesale || 0)}</td>
      <td>${formatBRL(product.priceSuggested || 0)}</td>
      <td><input class="sale-qty-input" type="number" min="0" step="1" value="${qty}" data-product-id="${product.id}" title="Altere somente quando precisar de mais de uma unidade"></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".sale-add-btn").forEach(button => {
    button.addEventListener("click", () => addSaleSimulationProduct(button.dataset.productId));
  });
  tbody.querySelectorAll(".sale-qty-input").forEach(input => {
    input.addEventListener("input", e => setSaleSimulationQuantity(e.target.dataset.productId, e.target.value));
  });
  lucide.createIcons();
  updateSaleSimulatorSummary();
}

function calculateSaleSimulationTotals() {
  return getSaleSimulationItems().reduce((totals, item) => {
    const qty = item.quantity;
    totals.items += qty;
    totals.cost += (item.product.priceLastPurchase || 0) * qty;
    totals.wholesale += (item.product.priceWholesale || 0) * qty;
    totals.retail += (item.product.priceSuggested || 0) * qty;
    return totals;
  }, { items: 0, cost: 0, wholesale: 0, retail: 0 });
}

function updateSaleSimulatorSummary() {
  const totals = calculateSaleSimulationTotals();
  const wholesaleProfit = totals.wholesale - totals.cost;
  const retailProfit = totals.retail - totals.cost;
  const wholesaleMargin = totals.cost > 0 ? (wholesaleProfit / totals.cost) * 100 : 0;
  const retailMargin = totals.cost > 0 ? (retailProfit / totals.cost) * 100 : 0;

  const values = {
    "sale-total-cost": formatBRL(totals.cost),
    "sale-total-wholesale": formatBRL(totals.wholesale),
    "sale-profit-wholesale": formatBRL(wholesaleProfit),
    "sale-margin-wholesale": `${wholesaleMargin.toFixed(1)}%`,
    "sale-total-retail": formatBRL(totals.retail),
    "sale-profit-retail": formatBRL(retailProfit),
    "sale-margin-retail": `${retailMargin.toFixed(1)}%`,
    "sale-simulator-items-count": `${totals.items} item(ns) selecionado(s)`
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function generateSaleQuoteText(mode) {
  const items = getSaleSimulationItems();
  if (items.length === 0) return "";
  const isWholesale = mode === "wholesale";
  const title = isWholesale ? "ORÇAMENTO DE ATACADO" : "ORÇAMENTO DE VENDA";
  let total = 0;
  let text = `*${title} — GS2 IMPORTS*\n\n`;
  items.forEach(item => {
    const price = isWholesale ? item.product.priceWholesale : item.product.priceSuggested;
    const subtotal = price * item.quantity;
    total += subtotal;
    text += `${item.quantity}x ${item.product.name} — ${formatBRL(price)} cada — ${formatBRL(subtotal)}\n`;
  });
  text += `\n*TOTAL: ${formatBRL(total)}*`;
  return text;
}

function copySaleQuote(mode) {
  const text = generateSaleQuoteText(mode);
  if (!text) return showToast("Selecione pelo menos um produto.", true);
  navigator.clipboard.writeText(text)
    .then(() => showToast("Orçamento copiado!"))
    .catch(() => showToast("Não foi possível copiar o orçamento.", true));
}

function sendSaleQuoteWhatsApp(mode) {
  const text = generateSaleQuoteText(mode);
  if (!text) return showToast("Selecione pelo menos um produto.", true);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
}

function generateSaleAdminText() {
  const items = getSaleSimulationItems();
  if (items.length === 0) return "";

  let totalCost = 0;
  let totalWholesale = 0;
  let totalRetail = 0;
  let text = `*RELATÓRIO ADMINISTRATIVO — GS2 IMPORTS*\n\n`;

  items.forEach(item => {
    const qty = item.quantity;
    const costUnit = item.product.priceLastPurchase || 0;
    const wholesaleUnit = item.product.priceWholesale || 0;
    const retailUnit = item.product.priceSuggested || 0;
    const costTotal = costUnit * qty;
    const wholesaleTotal = wholesaleUnit * qty;
    const retailTotal = retailUnit * qty;
    const wholesaleProfit = wholesaleTotal - costTotal;
    const retailProfit = retailTotal - costTotal;

    totalCost += costTotal;
    totalWholesale += wholesaleTotal;
    totalRetail += retailTotal;

    text += `*${qty}x ${item.product.name}*\n`;
    text += `Custo: ${formatBRL(costUnit)} cada | Total ${formatBRL(costTotal)}\n`;
    text += `Atacado: ${formatBRL(wholesaleUnit)} cada | Total ${formatBRL(wholesaleTotal)} | Lucro ${formatBRL(wholesaleProfit)}\n`;
    text += `Venda normal: ${formatBRL(retailUnit)} cada | Total ${formatBRL(retailTotal)} | Lucro ${formatBRL(retailProfit)}\n\n`;
  });

  const totalWholesaleProfit = totalWholesale - totalCost;
  const totalRetailProfit = totalRetail - totalCost;
  const wholesaleMargin = totalCost > 0 ? (totalWholesaleProfit / totalCost) * 100 : 0;
  const retailMargin = totalCost > 0 ? (totalRetailProfit / totalCost) * 100 : 0;

  text += `*RESUMO GERAL*\n`;
  text += `Custo total: ${formatBRL(totalCost)}\n\n`;
  text += `*OPERAÇÃO ATACADO*\n`;
  text += `Venda total: ${formatBRL(totalWholesale)}\n`;
  text += `Lucro total: ${formatBRL(totalWholesaleProfit)} (${wholesaleMargin.toFixed(1)}%)\n\n`;
  text += `*OPERAÇÃO VENDA NORMAL*\n`;
  text += `Venda total: ${formatBRL(totalRetail)}\n`;
  text += `Lucro total: ${formatBRL(totalRetailProfit)} (${retailMargin.toFixed(1)}%)`;

  return text;
}

function sendSaleAdminWhatsApp() {
  const text = generateSaleAdminText();
  if (!text) return showToast("Selecione pelo menos um produto.", true);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
}

// ==========================================
// DETALHES DO PRODUTO
// ==========================================
function openProductDetails(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const isWholesale = isWholesaleAuthenticated();

  document.getElementById("detail-product-image").src = product.image;
  document.getElementById("detail-product-category").textContent = product.category || "";
  document.getElementById("detail-product-title").textContent = product.name;
  document.getElementById("detail-product-description").textContent = product.description || "";

  const priceWholesaleEl = document.getElementById("detail-product-price-wholesale");
  const priceSuggestedEl = document.getElementById("detail-product-price-suggested");

  if (isWholesale) {
    priceWholesaleEl.parentElement.style.display = "block";
    priceSuggestedEl.parentElement.style.display = "none";
    priceWholesaleEl.textContent = formatBRL(product.priceWholesale);
  } else {
    priceWholesaleEl.parentElement.style.display = "none";
    priceSuggestedEl.parentElement.style.display = "block";
    priceSuggestedEl.textContent = formatBRL(product.priceSuggested);
  }

  document.getElementById("detail-product-quantity").value = 1;
  document.getElementById("btn-add-to-cart-detail").onclick = () => {
    const qty = parseInt(document.getElementById("detail-product-quantity").value) || 1;
    addToCart(product.id, qty);
    document.getElementById("product-detail-modal").classList.remove("active");
  };

  document.getElementById("product-detail-modal").classList.add("active");
}

// ==========================================
// FORMULÁRIO DE PRODUTO — ABRIR / FECHAR
// ==========================================
function openProductForm(productId) {
  editingProductId = productId || null;
  const form = document.getElementById("product-form");
  form.reset();
  document.getElementById("product-form-id").value = "";
  document.getElementById("upload-preview-container").style.display = "none";
  uploadedImageFile = null;
  currentPreviewUrl = null;
  selectedBrand = "";
  selectedCategory = "";

  if (productId) {
    const product = allProducts.find(p => String(p.id) === String(productId));
    if (!product) return;
    document.getElementById("product-form-id").value = product.id;
    document.getElementById("form-modal-title").textContent = "Editar Produto";
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-brand").value = product.brand || "";
    document.getElementById("product-category").value = product.category || "";
    document.getElementById("product-gender").value = product.gender || "";
    document.getElementById("product-price-last-purchase").value = product.priceLastPurchase || "";
    document.getElementById("product-price-wholesale").value = product.priceWholesale || "";
    document.getElementById("product-price-market-avg").value = product.priceMarketAvg || "";
    document.getElementById("product-price-suggested").value = product.priceSuggested || "";
    document.getElementById("product-quantity").value = product.quantity || "";
    document.getElementById("product-desc").value = product.description || "";

    selectedBrand = product.brand || "";
    selectedCategory = product.category || "";

    currentPreviewUrl = product.image;
    document.getElementById("image-preview-element").src = product.image;
    document.getElementById("upload-preview-container").style.display = "block";

    // Gender button state
    document.getElementById("btn-gender-masc").classList.toggle("active", product.gender === "Masculino");
    document.getElementById("btn-gender-fem").classList.toggle("active", product.gender === "Feminino");
  } else {
    document.getElementById("form-modal-title").textContent = "Adicionar Novo Produto";
    document.getElementById("btn-gender-masc").classList.remove("active");
    document.getElementById("btn-gender-fem").classList.remove("active");
  }

  renderBrandButtons();
  renderCategoryChips();
  updateGenderVisibility();
  updateProfitDisplay();
  
  // Controle do botão de histórico de compras
  const btnHistory = document.getElementById("btn-view-price-history");
  if (btnHistory) {
    if (productId && globalPriceHistory[productId] && globalPriceHistory[productId].length > 0) {
      btnHistory.style.display = "inline-flex";
      btnHistory.onclick = () => openPriceHistoryModal(productId);
    } else {
      btnHistory.style.display = "none";
    }
  }

  document.getElementById("product-form-modal").classList.add("active");
}

// ==========================================
// FORMULÁRIO DE PRODUTO E UPLOAD SUPABASE
// ==========================================
async function handleFormSubmit(event) {
  event.preventDefault();

  const id = document.getElementById("product-form-id").value || null;
  const productData = {
    name: document.getElementById("product-name").value,
    brand: document.getElementById("product-brand").value,
    category: document.getElementById("product-category").value,
    gender: document.getElementById("product-gender").value,
    priceLastPurchase: parseFloat(document.getElementById("product-price-last-purchase").value) || 0,
    priceWholesale: parseFloat(document.getElementById("product-price-wholesale").value) || 0,
    priceMarketAvg: parseFloat(document.getElementById("product-price-market-avg").value) || 0,
    priceSuggested: parseFloat(document.getElementById("product-price-suggested").value) || 0,
    quantity: parseInt(document.getElementById("product-quantity").value) || 0,
    description: document.getElementById("product-desc").value,
    image: currentPreviewUrl || ""
  };

  try {
    if (uploadedImageFile instanceof File) {
      const fileName = `${Date.now()}_${uploadedImageFile.name}`;
      const { data, error } = await sbClient.storage.from('products').upload(fileName, uploadedImageFile);
      if (error) throw error;
      const { data: publicUrlData } = sbClient.storage.from('products').getPublicUrl(fileName);
      productData.image = publicUrlData.publicUrl;
    }

    if (id) {
      productData.id = Number(id);
    }
    
    // Calcula mudança de quantidade (reposição de compras)
    let qtyAdded = 0;
    if (id) {
      const oldProduct = allProducts.find(p => String(p.id) === String(id));
      const oldQty = oldProduct ? (parseInt(oldProduct.quantity) || 0) : 0;
      if (productData.quantity > oldQty) {
        qtyAdded = productData.quantity - oldQty;
      }
    } else {
      qtyAdded = productData.quantity; // Novo produto começa com a qtd atual
    }

    const savedData = await CatalogDB.save(productData);
    const finalId = (savedData && savedData[0] && savedData[0].id) ? savedData[0].id : id;
    
    // Adicionar reposição/atualização no histórico
    if (finalId && (qtyAdded > 0 || (globalPriceHistory[finalId] === undefined))) {
       // Se tem estoque adicionado, ou se é totalmente novo e ainda não tem histórico (mesmo com qty 0)
       addPriceToHistory(finalId, productData.priceLastPurchase, qtyAdded);
    } else if (finalId && globalPriceHistory[finalId]) {
       // Se o preço foi alterado, mas qty não aumentou (apenas ajuste de preço)
       const history = globalPriceHistory[finalId];
       if (history.length > 0) {
         if (history[history.length - 1].price !== productData.priceLastPurchase) {
           addPriceToHistory(finalId, productData.priceLastPurchase, qtyAdded);
         }
       }
    }

    document.getElementById("product-form-modal").classList.remove("active");
    showToast(id ? "Produto atualizado com sucesso!" : "Produto adicionado com sucesso!");
    await loadProductsData();
  } catch (error) {
    console.error("Erro no salvamento:", error);
    const msg = error?.message || error?.details || JSON.stringify(error);
    showToast("Falha ao salvar: " + msg, "error");
  }
}

async function handleDeleteProduct(id) {
  if (confirm("Excluir este produto?")) {
    try {
      await CatalogDB.delete(id);
      showToast("Produto excluído!");
      await loadProductsData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      const msg = error?.message || error?.details || JSON.stringify(error);
      showToast("Falha ao deletar: " + msg, "error");
    }
  }
}

async function handleToggleAvailability(id) {
  const product = allProducts.find(p => String(p.id) === String(id));
  if (!product) return;

  product.unavailable = !product.unavailable;

  try {
    await CatalogDB.save(product);
    showToast(product.unavailable ? "Produto marcado como Sem Estoque!" : "Produto marcado como Disponível!");
    await loadProductsData();
  } catch (error) {
    console.error("Erro ao alterar disponibilidade:", error);
    const msg = error?.message || error?.details || JSON.stringify(error);
    showToast("Falha ao atualizar status: " + msg, "error");
  }
}

async function handleToggleTransit(id) {
  const product = allProducts.find(p => String(p.id) === String(id));
  if (!product) return;

  product.inTransit = !product.inTransit;

  try {
    await CatalogDB.save(product);
    showToast(product.inTransit ? "✈️ Produto marcado como Em Trânsito! Removido da lista de compras." : "Trânsito cancelado. Produto voltou à lista de compras.");
    await loadProductsData();
  } catch (error) {
    console.error("Erro ao alterar trânsito:", error);
    const msg = error?.message || error?.details || JSON.stringify(error);
    showToast("Falha ao atualizar trânsito: " + msg, "error");
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast-error" : ""}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}

// ==========================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  await CatalogDB.init();
  await loadPriceHistory(); // Carrega o histórico de preços
  await loadProductsData();

  // Fechar modais
  document.getElementById("btn-close-price-history-modal")?.addEventListener("click", () => {
    document.getElementById("price-history-modal").classList.remove("active");
  });
  document.getElementById("btn-close-top-sellers-modal")?.addEventListener("click", () => {
    document.getElementById("top-sellers-modal").classList.remove("active");
  });

  // Botão de ranking admin
  document.getElementById("btn-top-sellers")?.addEventListener("click", openTopSellersModal);


  // ── BOTÃO PAINEL ADMIN ──
  const adminBtn = document.getElementById("admin-view-toggle-btn");
  const catalogView = document.getElementById("catalog-view");
  const adminView = document.getElementById("admin-view");
  const adminLoginModal = document.getElementById("admin-login-modal");

  adminBtn.addEventListener("click", () => {
    if (!isAdminAuthenticated()) {
      adminLoginModal.classList.add("active");
    } else {
      logoutAdmin();
      catalogView.style.display = "block";
      adminView.style.display = "none";
      adminBtn.innerHTML = '<i data-lucide="settings"></i><span>Painel Admin</span>';
      lucide.createIcons();
      showToast("Sessão admin encerrada.");
    }
  });

  // ── BOTÃO CATÁLOGO ATACADO ──
  const wholesaleBtn = document.getElementById("wholesale-view-toggle-btn");
  const wholesaleLoginModal = document.getElementById("wholesale-login-modal");

  function updateWholesaleButtonState() {
    if (isWholesaleAuthenticated()) {
      wholesaleBtn.innerHTML = '<i data-lucide="percent"></i><span>Sair Atacado</span>';
      wholesaleBtn.style.background = 'linear-gradient(135deg, #800020, #5c021a)';
      wholesaleBtn.style.color = '#ffffff';
      wholesaleBtn.style.boxShadow = '0 2px 8px rgba(128,0,32,0.3)';
    } else {
      wholesaleBtn.innerHTML = '<i data-lucide="percent"></i><span>Área Atacado</span>';
      wholesaleBtn.style.background = 'linear-gradient(135deg, #c5a059, #e5c158)';
      wholesaleBtn.style.color = '#000000';
      wholesaleBtn.style.boxShadow = '0 2px 8px rgba(229,193,88,0.25)';
    }
    lucide.createIcons();
  }

  if (wholesaleBtn) {
    updateWholesaleButtonState();

    wholesaleBtn.addEventListener("click", () => {
      if (!isWholesaleAuthenticated()) {
        wholesaleLoginModal.classList.add("active");
      } else {
        logoutWholesale();
        currentCatalogLayout = "grid";
        document.getElementById("btn-view-grid").classList.add("active");
        document.getElementById("btn-view-list").classList.remove("active");
        updateWholesaleButtonState();
        applyFiltersAndRender();
        showToast("Sessão atacado encerrada.");
      }
    });
  }

  // ── LOGIN FORM ATACADO ──
  const wholesaleLoginForm = document.getElementById("wholesale-login-form");
  if (wholesaleLoginForm) {
    wholesaleLoginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const password = document.getElementById("wholesale-login-password").value;
      const errorMsg = document.getElementById("wholesale-login-error");

      if (loginWholesale(password)) {
        wholesaleLoginModal.classList.remove("active");
        document.getElementById("wholesale-login-password").value = "";
        errorMsg.textContent = "";
        currentCatalogLayout = "list";
        document.getElementById("btn-view-list").classList.add("active");
        document.getElementById("btn-view-grid").classList.remove("active");
        updateWholesaleButtonState();
        applyFiltersAndRender();
        showToast("Acesso ao Atacado liberado!");
      } else {
        errorMsg.textContent = "Senha de atacado incorreta.";
        wholesaleLoginModal.querySelector(".modal-container").style.animation = "shake 0.5s";
        setTimeout(() => { wholesaleLoginModal.querySelector(".modal-container").style.animation = ""; }, 500);
      }
    });
  }

  // ── PASSWORD TOGGLE ATACADO ──
  const toggleWholesalePasswordBtn = document.getElementById("btn-toggle-wholesale-password-visibility");
  if (toggleWholesalePasswordBtn) {
    toggleWholesalePasswordBtn.addEventListener("click", () => {
      const input = document.getElementById("wholesale-login-password");
      const eye = document.getElementById("icon-w-eye");
      const eyeOff = document.getElementById("icon-w-eye-off");
      if (input.type === "password") {
        input.type = "text"; eye.style.display = "none"; eyeOff.style.display = "block";
      } else {
        input.type = "password"; eye.style.display = "block"; eyeOff.style.display = "none";
      }
    });
  }

  // ── LOGIN FORM ──
  document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-login-password").value;
    const errorMsg = document.getElementById("admin-login-error");
    const submitBtn = document.querySelector("#admin-login-form button[type='submit']");

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Verificando..."; }

    if (await loginAdmin(password)) {
      adminLoginModal.classList.remove("active");
      document.getElementById("admin-login-password").value = "";
      errorMsg.textContent = "";
      catalogView.style.display = "none";
      adminView.style.display = "block";
      adminBtn.innerHTML = '<i data-lucide="check-circle"></i><span>Sair Admin</span>';
      lucide.createIcons();
      renderAdminProductsList();
      showToast("Acesso concedido!");
    } else {
      errorMsg.textContent = "Senha incorreta.";
      adminLoginModal.querySelector(".modal-container").style.animation = "shake 0.5s";
      setTimeout(() => { adminLoginModal.querySelector(".modal-container").style.animation = ""; }, 500);
    }

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Entrar"; }
  });

  // ── PASSWORD TOGGLE ──
  document.getElementById("btn-toggle-password-visibility").addEventListener("click", () => {
    const input = document.getElementById("admin-login-password");
    const eye = document.getElementById("icon-eye");
    const eyeOff = document.getElementById("icon-eye-off");
    if (input.type === "password") {
      input.type = "text"; eye.style.display = "none"; eyeOff.style.display = "block";
    } else {
      input.type = "password"; eye.style.display = "block"; eyeOff.style.display = "none";
    }
  });

  // ── ADMIN ACTIONS ──
  document.getElementById("btn-back-to-catalog").addEventListener("click", () => {
    logoutAdmin();
    catalogView.style.display = "block";
    adminView.style.display = "none";
    adminBtn.innerHTML = '<i data-lucide="settings"></i><span>Painel Admin</span>';
    lucide.createIcons();
  });

  document.getElementById("btn-admin-logout").addEventListener("click", () => {
    logoutAdmin();
    catalogView.style.display = "block";
    adminView.style.display = "none";
    adminBtn.innerHTML = '<i data-lucide="settings"></i><span>Painel Admin</span>';
    lucide.createIcons();
    showToast("Sessão admin encerrada.");
  });

  // ── ADD PRODUCT ──
  document.getElementById("btn-add-product").addEventListener("click", () => { openProductForm(); });


  // ── CHANGE PASSWORD ──
  document.getElementById("btn-change-password").addEventListener("click", () => {
    document.getElementById("change-password-modal").classList.add("active");
  });

  document.getElementById("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("current-password").value;
    const newPass = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;
    const errorMsg = document.getElementById("change-pass-error");
    const saveBtn = document.querySelector("#change-password-form button[type='submit']");

    const storedPass = await getStoredPassword();
    if (current !== storedPass) { errorMsg.textContent = "Senha atual incorreta."; return; }
    if (newPass.length < 4) { errorMsg.textContent = "Nova senha deve ter pelo menos 4 caracteres."; return; }
    if (newPass !== confirm) { errorMsg.textContent = "Novas senhas não conferem."; return; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Salvando..."; }
    try {
      await savePasswordToCloud(newPass);
      errorMsg.textContent = "";
      document.getElementById("change-password-form").reset();
      document.getElementById("change-password-modal").classList.remove("active");
      showToast("✅ Senha alterada e sincronizada em todos os dispositivos!");
    } catch (err) {
      errorMsg.textContent = "Erro ao salvar senha. Tente novamente.";
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Salvar"; }
    }
  });

  // ── PRODUCT FORM ──
  document.getElementById("product-form").addEventListener("submit", handleFormSubmit);

  // ── IMAGE UPLOAD ──
  document.getElementById("product-image-file").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadedImageFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentPreviewUrl = ev.target.result;
        document.getElementById("image-preview-element").src = currentPreviewUrl;
        document.getElementById("upload-preview-container").style.display = "block";
      };
      reader.readAsDataURL(uploadedImageFile);
    }
  });

  document.getElementById("btn-remove-preview").addEventListener("click", () => {
    uploadedImageFile = null;
    currentPreviewUrl = null;
    document.getElementById("upload-preview-container").style.display = "none";
    document.getElementById("product-image-file").value = "";
  });

  // ── IMAGE MODE TABS ──
  document.querySelectorAll(".img-mode-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".img-mode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      document.getElementById("panel-upload").style.display = name === "upload" ? "block" : "none";
      document.getElementById("panel-url").style.display = name === "url" ? "block" : "none";
    });
  });

  // ── URL IMAGE LOAD ──
  document.getElementById("btn-load-url-image").addEventListener("click", () => {
    const url = document.getElementById("product-image-url").value.trim();
    if (!url) { showToast("Digite uma URL válida!", "error"); return; }
    currentPreviewUrl = url;
    uploadedImageFile = null;
    document.getElementById("image-preview-element").src = url;
    document.getElementById("upload-preview-container").style.display = "block";
    document.getElementById("url-image-error").style.display = "none";
  });

  // ── BRAND ADD ──
  document.getElementById("btn-add-brand").addEventListener("click", () => {
    const name = prompt("Nome da nova marca:");
    if (name && name.trim()) {
      const brands = getBrands();
      if (!brands.includes(name.trim())) { brands.push(name.trim()); saveBrands(brands); }
      selectedBrand = name.trim();
      document.getElementById("product-brand").value = selectedBrand;
      renderBrandButtons();
    }
  });

  // ── CATEGORY ADD ──
  document.getElementById("btn-add-category").addEventListener("click", () => {
    const name = prompt("Nome da nova categoria:");
    if (name && name.trim()) {
      const cats = getCategoryList();
      if (!cats.includes(name.trim())) { cats.push(name.trim()); saveCategoryList(cats); }
      selectedCategory = name.trim();
      document.getElementById("product-category").value = selectedCategory;
      renderCategoryChips();
    }
  });

  // ── GENDER BUTTONS ──
  document.getElementById("btn-gender-masc").addEventListener("click", () => {
    const btn = document.getElementById("btn-gender-masc");
    const isActive = btn.classList.contains("active");
    document.getElementById("btn-gender-masc").classList.remove("active");
    document.getElementById("btn-gender-fem").classList.remove("active");
    if (!isActive) {
      btn.classList.add("active");
      document.getElementById("product-gender").value = "Masculino";
    } else {
      document.getElementById("product-gender").value = "";
    }
  });

  document.getElementById("btn-gender-fem").addEventListener("click", () => {
    const btn = document.getElementById("btn-gender-fem");
    const isActive = btn.classList.contains("active");
    document.getElementById("btn-gender-masc").classList.remove("active");
    document.getElementById("btn-gender-fem").classList.remove("active");
    if (!isActive) {
      btn.classList.add("active");
      document.getElementById("product-gender").value = "Feminino";
    } else {
      document.getElementById("product-gender").value = "";
    }
  });

  // ── AUTO-CALC WHOLESALE PRICE ──
  document.getElementById("product-price-last-purchase").addEventListener("input", () => {
    const val = parseFloat(document.getElementById("product-price-last-purchase").value);
    if (val > 0) {
      document.getElementById("product-price-wholesale").value = (val * 1.10).toFixed(2);
    }
    updateProfitDisplay();
  });

  document.getElementById("product-price-suggested").addEventListener("input", () => {
    updateProfitDisplay();
  });

  // ── GOOGLE SHOPPING SEARCH ──
  document.getElementById("btn-google-shopping").addEventListener("click", () => {
    const name = document.getElementById("product-name").value;
    if (name) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(name)}&tbm=shop`, "_blank");
    }
  });

  // ── CLOSE MODALS (X BUTTONS) ──
  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal-overlay");
      if (modal) modal.classList.remove("active");
    });
  });

  // ── CLOSE MODALS (CLICK OUTSIDE) ──
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  });

  // ── CANCEL FORM ──
  document.getElementById("btn-cancel-form").addEventListener("click", () => {
    document.getElementById("product-form-modal").classList.remove("active");
  });

  // ── SEARCH ──
  document.getElementById("search-input").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    applyFiltersAndRender();
  });

  // ── BRAND & AVAILABILITY SELECTS ──
  document.getElementById("brand-select")?.addEventListener("change", (e) => {
    currentBrand = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("availability-select")?.addEventListener("change", (e) => {
    currentAvailability = e.target.value;
    applyFiltersAndRender();
  });

  // ── SORT ──
  document.getElementById("sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    catalogSortCol = null; // Reseta ordenação da tabela quando muda o select
    applyFiltersAndRender();
  });

  // ── CONTROLE DE VISUALIZAÇÃO (GRADE / LISTA) ──
  const btnViewGrid = document.getElementById("btn-view-grid");
  const btnViewList = document.getElementById("btn-view-list");

  if (btnViewGrid && btnViewList) {
    btnViewGrid.addEventListener("click", () => {
      currentCatalogLayout = "grid";
      btnViewGrid.classList.add("active");
      btnViewList.classList.remove("active");
      applyFiltersAndRender();
    });

    btnViewList.addEventListener("click", () => {
      currentCatalogLayout = "list";
      btnViewList.classList.add("active");
      btnViewGrid.classList.remove("active");
      applyFiltersAndRender();
    });
  }

  // ── ADMIN TABLE SORT ──
  document.querySelectorAll(".admin-th-sort").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (adminSortCol === col) {
        adminSortDir = adminSortDir === "asc" ? "desc" : "asc";
      } else {
        adminSortCol = col;
        adminSortDir = "asc";
      }
      renderAdminProductsList();
    });
  });

  // ── CART EVENTS ──
  document.getElementById("btn-detail-qty-minus").addEventListener("click", () => {
    const input = document.getElementById("detail-product-quantity");
    let v = parseInt(input.value) || 1;
    if (v > 1) input.value = v - 1;
  });
  document.getElementById("btn-detail-qty-plus").addEventListener("click", () => {
    const input = document.getElementById("detail-product-quantity");
    let v = parseInt(input.value) || 1;
    input.value = v + 1;
  });

  document.getElementById("floating-cart-btn").addEventListener("click", () => {
    document.getElementById("cart-modal").classList.add("active");
  });

  // Fecha o modal do carrinho
  const btnCloseCartModal = document.getElementById("btn-close-cart-modal");
  if (btnCloseCartModal) {
    btnCloseCartModal.addEventListener("click", () => {
      document.getElementById("cart-modal")?.classList.remove("active");
    });
  }

  // Envia o pedido do carrinho pelo WhatsApp
  const btnSendWhatsAppOrder = document.getElementById("btn-send-whatsapp-order");
  if (btnSendWhatsAppOrder) {
    btnSendWhatsAppOrder.addEventListener("click", sendCartToWhatsApp);
  }

  // ── ADMIN AVAILABILITY FILTERS & SEARCH ──
  const adminAvailTabs = document.querySelectorAll("#admin-availability-tabs .filter-chip");
  adminAvailTabs.forEach(chip => {
    chip.addEventListener("click", () => {
      adminAvailTabs.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      adminAvailabilityFilter = chip.dataset.status || "all";
      renderAdminProductsList();
    });
  });

  const adminSearchInput = document.getElementById("admin-search-input");
  if (adminSearchInput) {
    adminSearchInput.addEventListener("input", (e) => {
      adminSearchQuery = e.target.value;
      renderAdminProductsList();
    });
  }

  // ── SHOPPING LIST EVENTS ──
  const btnShoppingList = document.getElementById("btn-shopping-list");
  if (btnShoppingList) {
    btnShoppingList.addEventListener("click", () => {
      openShoppingListModal();
    });
  }

  const btnCopyShoppingList = document.getElementById("btn-copy-shopping-list");
  if (btnCopyShoppingList) {
    btnCopyShoppingList.addEventListener("click", () => {
      copyShoppingList();
    });
  }

  const btnWhatsappShoppingList = document.getElementById("btn-whatsapp-shopping-list");
  if (btnWhatsappShoppingList) {
    btnWhatsappShoppingList.addEventListener("click", () => {
      sendShoppingListWhatsApp();
    });
  }

  // ── SALE SIMULATOR EVENTS ──
  document.getElementById("btn-sale-simulator")?.addEventListener("click", openSaleSimulator);
  document.getElementById("btn-close-sale-simulator")?.addEventListener("click", () => {
    document.getElementById("sale-simulator-modal")?.classList.remove("active");
  });
  document.getElementById("sale-simulator-search")?.addEventListener("input", e => {
    saleSimulationSearch = e.target.value;
    renderSaleSimulatorProducts();
  });
  document.getElementById("btn-clear-sale-simulator")?.addEventListener("click", () => {
    saleSimulation.clear();
    renderSaleSimulatorProducts();
  });
  document.getElementById("btn-copy-wholesale-quote")?.addEventListener("click", () => copySaleQuote("wholesale"));
  document.getElementById("btn-copy-retail-quote")?.addEventListener("click", () => copySaleQuote("retail"));
  document.getElementById("btn-whatsapp-wholesale-quote")?.addEventListener("click", () => sendSaleQuoteWhatsApp("wholesale"));
  document.getElementById("btn-whatsapp-retail-quote")?.addEventListener("click", () => sendSaleQuoteWhatsApp("retail"));
  document.getElementById("btn-whatsapp-admin-quote")?.addEventListener("click", sendSaleAdminWhatsApp);

  // ── WHOLESALE LIST MODAL EVENTS ──
  const btnWholesaleShareList = document.getElementById("btn-wholesale-share-list");
  if (btnWholesaleShareList) {
    btnWholesaleShareList.addEventListener("click", () => {
      openWholesaleListModal();
    });
  }

  const btnCloseWholesaleModal = document.getElementById("btn-close-wholesale-list-modal");
  if (btnCloseWholesaleModal) {
    btnCloseWholesaleModal.addEventListener("click", () => {
      document.getElementById("wholesale-list-modal")?.classList.remove("active");
    });
  }

  const btnCopyWholesaleList = document.getElementById("btn-copy-wholesale-list");
  if (btnCopyWholesaleList) {
    btnCopyWholesaleList.addEventListener("click", () => {
      copyWholesaleList();
    });
  }

  const btnWhatsappWholesaleList = document.getElementById("btn-whatsapp-wholesale-list");
  if (btnWhatsappWholesaleList) {
    btnWhatsappWholesaleList.addEventListener("click", () => {
      sendWholesaleListWhatsApp();
    });
  }

  // ── INITIAL ICONS ──
  lucide.createIcons();

  console.log("Sistema GS2 Imports inicializado com sucesso.");
});

// ==========================================
// FUNÇÕES DO CARRINHO DE COMPRAS
// ==========================================
function addToCart(productId, qty = 1) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  const existing = cart.find(item => String(item.product.id) === String(productId));
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ product, quantity: qty });
  }

  showToast(qty > 1 ? `${qty} unidades adicionadas ao pedido!` : "Produto adicionado ao pedido!");
  updateCartUI();
}

function removeFromCart(productId) {
  cart = cart.filter(item => String(item.product.id) !== String(productId));
  updateCartUI();
}

function updateCartQuantity(productId, delta) {
  const item = cart.find(i => String(i.product.id) === String(productId));
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) removeFromCart(productId);
    else updateCartUI();
  }
}

function updateCartUI() {
  const isWholesale = isWholesaleAuthenticated();
  const badge = document.getElementById("floating-cart-badge");
  const btn = document.getElementById("floating-cart-btn");
  const container = document.getElementById("cart-items-container");
  const totalValueEl = document.getElementById("cart-total-value");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = totalItems;
  
  if (totalItems > 0) {
    btn.style.display = "flex";
  } else {
    btn.style.display = "none";
    document.getElementById("cart-modal").classList.remove("active");
  }

  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem 0;">
        <i data-lucide="shopping-cart" style="width:48px;height:48px; opacity: 0.5;"></i>
        <p>Seu carrinho está vazio.</p>
      </div>`;
    totalValueEl.textContent = "R$ 0,00";
    lucide.createIcons();
    return;
  }

  let totalValue = 0;
  cart.forEach(item => {
    const price = isWholesale ? item.product.priceWholesale : item.product.priceSuggested;
    totalValue += price * item.quantity;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-image">
      <div class="cart-item-details">
        <div class="cart-item-title">${item.product.name}</div>
        <div class="cart-item-price">${formatBRL(price)} ${isWholesale ? '<span style="font-size:0.6rem;color:var(--text-muted);">(Atacado)</span>' : ''}</div>
      </div>
      <div class="cart-item-actions">
        <div class="cart-qty-control">
          <button class="cart-qty-btn" onclick="updateCartQuantity('${item.product.id}', -1)"><i data-lucide="minus" style="width:12px;height:12px;"></i></button>
          <input type="text" class="cart-qty-input" value="${item.quantity}" readonly>
          <button class="cart-qty-btn" onclick="updateCartQuantity('${item.product.id}', 1)"><i data-lucide="plus" style="width:12px;height:12px;"></i></button>
        </div>
        <button class="btn-remove-item" onclick="removeFromCart('${item.product.id}')"><i data-lucide="trash-2" style="width:12px;height:12px;"></i> Remover</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalValueEl.textContent = formatBRL(totalValue);
  lucide.createIcons();
}

function sendCartToWhatsApp() {
  if (cart.length === 0) return;
  const isWholesale = isWholesaleAuthenticated();
  const modeText = isWholesale ? "(Atacado)" : "(Varejo)";
  
  let text = `Olá! Gostaria de fazer o seguinte pedido ${modeText}:\n\n`;
  let totalValue = 0;

  cart.forEach(item => {
    const price = isWholesale ? item.product.priceWholesale : item.product.priceSuggested;
    totalValue += price * item.quantity;
    text += `- ${item.quantity}x ${item.product.name} (R$ ${price.toFixed(2)} cada)\n`;
  });

  text += `\n*Total do Pedido:* ${formatBRL(totalValue)}`;
  
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
  
  // Esvazia carrinho após pedido
  cart = [];
  updateCartUI();
  document.getElementById("cart-modal").classList.remove("active");
  showToast("Pedido enviado para o WhatsApp!");
}
