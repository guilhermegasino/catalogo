// ==========================================
// AUTENTICAÇÃO E CONFIGURAÇÕES GLOBAIS
// ==========================================
const ADMIN_SESSION_KEY  = "gs2_admin_authenticated";
const ADMIN_PASS_KEY     = "gs2_admin_password";
const DEFAULT_ADMIN_PASS = "gs2admin";
const WHATSAPP_NUMBER    = "5547988614670";
const BRANDS_KEY         = "gs2_brands";
const CATEGORIES_KEY     = "gs2_categories";

let allProducts = [], filteredProducts = [], selectedBrand = "", selectedCategory = "";
let currentCategory = "all", currentGender = "all", currentBrand = "all", currentSearch = "", currentSort = "default";
let adminSortCol = null, adminSortDir = "asc", uploadedImageFile = null, currentPreviewUrl = null;
let editingProductId = null;
const objectUrlCache = new Map();

function isAdminAuthenticated() { return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true"; }
function getStoredPassword() { return localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS; }
function loginAdmin(password) {
  if (password === getStoredPassword()) { sessionStorage.setItem(ADMIN_SESSION_KEY, "true"); return true; }
  return false;
}
function logoutAdmin() { sessionStorage.removeItem(ADMIN_SESSION_KEY); }

// ==========================================
// GERENCIAMENTO DE MARCAS E CATEGORIAS
// ==========================================
function getBrands() { try { return JSON.parse(localStorage.getItem(BRANDS_KEY) || "[]"); } catch { return []; } }
function saveBrands(brands) { localStorage.setItem(BRANDS_KEY, JSON.stringify(brands)); }
function getCategoryList() { try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]"); } catch { return []; } }
function saveCategoryList(cats) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats)); }

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
    chip.querySelector("span").onclick = () => { selectedCategory = (selectedCategory === cat) ? "" : cat; sel.value = selectedCategory; renderCategoryChips(); };
    chip.querySelector("button").onclick = (e) => { e.stopPropagation(); saveCategoryList(getCategoryList().filter(c => c !== cat)); renderCategoryChips(); };
    container.appendChild(chip);
  });
}

function renderCategoryTabs() {
  const tabs = document.getElementById("categories-tabs");
  if (!tabs) return;
  const uniqueCats = ["all", ...new Set(allProducts.map(p => p.category?.trim()).filter(Boolean))];
  tabs.innerHTML = "";
  uniqueCats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `category-tab ${currentCategory === cat ? "active" : ""}`;
    btn.textContent = cat === "all" ? "Todos" : cat;
    btn.onclick = () => { currentCategory = cat; applyFiltersAndRender(); };
    tabs.appendChild(btn);
  });
}

function renderGenderTabs() {
  const tabs = document.getElementById("gender-tabs");
  if (!tabs) return;
  const genders = [
    { id: "all", label: "Todos" },
    { id: "Masculino", label: "Masculino" },
    { id: "Feminino", label: "Feminino" }
  ];
  tabs.innerHTML = "";
  genders.forEach(gen => {
    const btn = document.createElement("button");
    btn.className = `gender-tab ${currentGender === gen.id ? "active" : ""}`;
    btn.textContent = gen.label;
    btn.onclick = () => { currentGender = gen.id; applyFiltersAndRender(); };
    tabs.appendChild(btn);
  });
}

function renderBrandFilterTabs() {
  const tabs = document.getElementById("brand-filter-tabs");
  const row = document.getElementById("brand-filter-row");
  if (!tabs || !row) return;
  const uniqueBrands = [...new Set(allProducts.map(p => p.brand?.trim()).filter(Boolean))].sort();
  if (uniqueBrands.length === 0) { row.style.display = "none"; return; }
  row.style.display = "";
  uniqueBrands.unshift("all");
  tabs.innerHTML = "";
  uniqueBrands.forEach(brand => {
    const btn = document.createElement("button");
    btn.className = `category-tab brand-filter-tab ${currentBrand === brand ? "active" : ""}`;
    btn.textContent = brand === "all" ? "Todos" : brand;
    btn.onclick = () => { currentBrand = brand; applyFiltersAndRender(); };
    tabs.appendChild(btn);
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

function applyFiltersAndRender() {
  filteredProducts = allProducts.filter(p =>
    (currentCategory === "all" || p.category.toLowerCase() === currentCategory.toLowerCase()) &&
    (currentGender === "all" || (p.gender || "") === currentGender) &&
    (currentBrand === "all" || (p.brand || "") === currentBrand) &&
    (currentSearch === "" || p.name.toLowerCase().includes(currentSearch.toLowerCase()))
  );

  if (currentSort === "price-asc") filteredProducts.sort((a, b) => a.priceWholesale - b.priceWholesale);
  else if (currentSort === "price-desc") filteredProducts.sort((a, b) => b.priceWholesale - a.priceWholesale);
  else if (currentSort === "name-asc") filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  else if (currentSort === "name-desc") filteredProducts.sort((a, b) => b.name.localeCompare(a.name));

  renderCatalogGrid();
  renderCategoryTabs();
  renderGenderTabs();
  renderBrandFilterTabs();
  if (document.getElementById("admin-view").style.display !== "none") renderAdminProductsList();
}

function formatBRL(val) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function renderCatalogGrid() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = filteredProducts.length === 0 ? '<div class="empty-state"><i data-lucide="package-open" style="width:48px;height:48px;"></i><p>Nenhum produto encontrado.</p></div>' : "";

  filteredProducts.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card" + (product.unavailable ? " product-unavailable" : "");
    card.onclick = () => openProductDetails(product.id);
    card.innerHTML = `
      <div class="product-card-image-wrapper">
        <img class="product-card-image" src="${product.image}" alt="${product.name}">
        ${product.unavailable ? '<span class="unavailable-badge">Indisponível</span>' : ''}
        <span class="product-category-tag">${product.category || ''}</span>
        ${product.gender ? `<span class="product-gender-tag product-gender-tag--${product.gender === 'Masculino' ? 'masc' : 'fem'}">${product.gender === 'Masculino' ? '♂' : '♀'}</span>` : ''}
        ${product.brand ? `<span class="product-brand-tag">${product.brand}</span>` : ''}
      </div>
      <div class="product-card-content">
        <h3 class="product-card-title">${product.name}</h3>
        ${product.description ? `<p class="product-card-desc">${product.description}</p>` : ''}
        <div class="product-card-footer">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <div>
              <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);opacity:0.7;">Atacado</div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--text-main);">${formatBRL(product.priceWholesale)}</div>
            </div>
            <div>
              <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);opacity:0.7;">Sug. Venda</div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--accent-blue);">${formatBRL(product.priceSuggested)}</div>
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:0.5rem;" onclick="event.stopPropagation(); openProductDetails('${product.id}')">
            <i data-lucide="eye" style="width:15px;height:15px;"></i> Detalhes
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  lucide.createIcons();
}

function renderAdminProductsList() {
  const list = document.getElementById("admin-products-list");
  if (!list) return;
  list.innerHTML = "";

  let sorted = [...allProducts];
  if (adminSortCol) {
    sorted.sort((a, b) => {
      let va = a[adminSortCol], vb = b[adminSortCol];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return adminSortDir === "asc" ? -1 : 1;
      if (va > vb) return adminSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  sorted.forEach(product => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img class="admin-prod-thumb" src="${product.image}" alt="${product.name}"></td>
      <td>${product.name}</td>
      <td>${product.category || ''}</td>
      <td>${product.priceLastPurchase ? formatBRL(product.priceLastPurchase) : '—'}</td>
      <td>${formatBRL(product.priceWholesale)}</td>
      <td>${formatBRL(product.priceSuggested)}</td>
      <td>${product.quantity || 0}</td>
      <td>
        <div class="admin-actions">
          <button class="btn-icon-only" title="Editar" onclick="openProductForm('${product.id}')"><i data-lucide="edit-2" style="width:15px;height:15px;"></i></button>
          <button class="btn-icon-only btn-delete" title="Excluir" onclick="handleDeleteProduct('${product.id}')"><i data-lucide="trash-2" style="width:15px;height:15px;"></i></button>
        </div>
      </td>
    `;
    list.appendChild(tr);
  });
  lucide.createIcons();
}

// ==========================================
// DETALHES DO PRODUTO
// ==========================================
function openProductDetails(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  document.getElementById("detail-product-image").src = product.image;
  document.getElementById("detail-product-category").textContent = product.category || "";
  document.getElementById("detail-product-title").textContent = product.name;
  document.getElementById("detail-product-price-wholesale").textContent = formatBRL(product.priceWholesale);
  document.getElementById("detail-product-price-suggested").textContent = formatBRL(product.priceSuggested);
  document.getElementById("detail-product-description").textContent = product.description || "";

  const whatsappText = `Olá! Gostaria de fazer um pedido do produto: ${product.name} — ${formatBRL(product.priceWholesale)}`;
  document.getElementById("btn-whatsapp-contact").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`;

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
    const product = allProducts.find(p => p.id === productId);
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
      productData.id = id;
      await CatalogDB.update(productData);
    } else {
      await CatalogDB.save(productData);
    }

    document.getElementById("product-form-modal").classList.remove("active");
    showToast(id ? "Produto atualizado com sucesso!" : "Produto adicionado com sucesso!");
    await loadProductsData();
  } catch (error) {
    console.error("Erro no salvamento:", error);
    showToast("Falha ao salvar produto.", "error");
  }
}

async function handleDeleteProduct(id) {
  if (confirm("Excluir este produto?")) {
    await CatalogDB.delete(id);
    showToast("Produto excluído!");
    await loadProductsData();
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
  await loadProductsData();

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

  // ── LOGIN FORM ──
  document.getElementById("admin-login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-login-password").value;
    const errorMsg = document.getElementById("admin-login-error");

    if (loginAdmin(password)) {
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

  // ── RESET DB ──
  document.getElementById("btn-reset-db").addEventListener("click", async () => {
    if (confirm("Restaurar catálogo padrão? Todos os dados atuais serão substituídos.")) {
      for (const product of INITIAL_PRODUCTS) {
        await CatalogDB.save(product);
      }
      showToast("Catálogo restaurado!");
      await loadProductsData();
      renderAdminProductsList();
    }
  });

  // ── CHANGE PASSWORD ──
  document.getElementById("btn-change-password").addEventListener("click", () => {
    document.getElementById("change-password-modal").classList.add("active");
  });

  document.getElementById("change-password-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const current = document.getElementById("current-password").value;
    const newPass = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;
    const errorMsg = document.getElementById("change-pass-error");

    if (current !== getStoredPassword()) { errorMsg.textContent = "Senha atual incorreta."; return; }
    if (newPass.length < 4) { errorMsg.textContent = "Nova senha deve ter pelo menos 4 caracteres."; return; }
    if (newPass !== confirm) { errorMsg.textContent = "Novas senhas não conferem."; return; }

    localStorage.setItem(ADMIN_PASS_KEY, newPass);
    errorMsg.textContent = "";
    document.getElementById("change-password-form").reset();
    document.getElementById("change-password-modal").classList.remove("active");
    showToast("Senha alterada com sucesso!");
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

  // ── SORT ──
  document.getElementById("sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFiltersAndRender();
  });

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

  // ── INITIAL ICONS ──
  lucide.createIcons();

  console.log("Sistema GS2 Imports inicializado com sucesso.");
});
