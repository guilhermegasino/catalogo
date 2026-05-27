// ==========================================
// AUTENTICAÇÃO DO PAINEL ADMIN
// ==========================================
const ADMIN_SESSION_KEY  = "gs2_admin_authenticated";
const ADMIN_PASS_KEY     = "gs2_admin_password";
const DEFAULT_ADMIN_PASS = "gs2admin";

function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function getStoredPassword() {
  return localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;
}

function loginAdmin(password) {
  if (password === getStoredPassword()) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    return true;
  }
  return false;
}

function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function openAdminLoginModal() {
  dom.adminLoginModal.classList.add("active");
  dom.adminLoginPassword.value = "";
  dom.adminLoginError.textContent = "";
  setTimeout(() => dom.adminLoginPassword.focus(), 150);
}

function closeAdminLoginModal() {
  dom.adminLoginModal.classList.remove("active");
}

function handleAdminLogin(e) {
  e.preventDefault();
  const pass = dom.adminLoginPassword.value;
  if (loginAdmin(pass)) {
    closeAdminLoginModal();
    // Agora entra no painel
    switchToAdminView();
  } else {
    dom.adminLoginError.textContent = "Senha incorreta. Tente novamente.";
    dom.adminLoginPassword.value = "";
    dom.adminLoginPassword.focus();
    // Efeito shake no input
    dom.adminLoginPassword.style.animation = "none";
    dom.adminLoginPassword.offsetHeight; // reflow
    dom.adminLoginPassword.style.animation = "shake 0.35s ease";
  }
}

function openChangePasswordModal() {
  dom.changePasswordModal.classList.add("active");
  dom.currentPassword.value = "";
  dom.newPassword.value = "";
  dom.confirmPassword.value = "";
  dom.changePassError.textContent = "";
}

function closeChangePasswordModal() {
  dom.changePasswordModal.classList.remove("active");
}

function handleChangePassword(e) {
  e.preventDefault();
  const current = dom.currentPassword.value;
  const next    = dom.newPassword.value;
  const confirm = dom.confirmPassword.value;

  if (current !== getStoredPassword()) {
    dom.changePassError.textContent = "Senha atual incorreta.";
    return;
  }
  if (next.length < 4) {
    dom.changePassError.textContent = "A nova senha deve ter pelo menos 4 caracteres.";
    return;
  }
  if (next !== confirm) {
    dom.changePassError.textContent = "As senhas não coincidem.";
    return;
  }

  localStorage.setItem(ADMIN_PASS_KEY, next);
  closeChangePasswordModal();
  showToast("Senha alterada com sucesso!", "success");
}

// ==========================================
// CONFIGURAÇÕES GLOBAIS
// ==========================================
const WHATSAPP_NUMBER = "5521966407570"; // Substituir pelo número real (DDI + DDD + Número)
let allProducts = [];
let filteredProducts = [];
let currentCategory = "all";
let currentGender   = "all";
let currentSearch = "";
let currentSort = "default";
let uploadedImageFile = null;
let currentPreviewUrl = null;
const objectUrlCache = new Map();

// Elementos do DOM
const dom = {
  // Telas principais
  catalogView: document.getElementById("catalog-view"),
  adminView: document.getElementById("admin-view"),
  
  // Elementos do Cabeçalho
  logoLink: document.getElementById("logo-link"),
  searchInput: document.getElementById("search-input"),
  searchContainer: document.getElementById("search-container"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  themeIconSun: document.getElementById("theme-icon-sun"),
  themeIconMoon: document.getElementById("theme-icon-moon"),
  adminViewToggleBtn: document.getElementById("admin-view-toggle-btn"),
  
  // Controles do Catálogo
  categoriesTabs: document.getElementById("categories-tabs"),
  genderTabs: document.getElementById("gender-tabs"),
  sortSelect: document.getElementById("sort-select"),
  productGrid: document.getElementById("product-grid"),
  
  // Painel Admin
  btnResetDb: document.getElementById("btn-reset-db"),
  btnAddProduct: document.getElementById("btn-add-product"),
  btnBackToCatalog: document.getElementById("btn-back-to-catalog"),
  btnAdminLogout: document.getElementById("btn-admin-logout"),
  btnChangePassword: document.getElementById("btn-change-password"),
  adminProductsList: document.getElementById("admin-products-list"),

  // Modal de Login Admin
  adminLoginModal: document.getElementById("admin-login-modal"),
  adminLoginForm: document.getElementById("admin-login-form"),
  adminLoginPassword: document.getElementById("admin-login-password"),
  adminLoginError: document.getElementById("admin-login-error"),
  btnCloseLoginModal: document.getElementById("btn-close-login-modal"),
  btnTogglePasswordVisibility: document.getElementById("btn-toggle-password-visibility"),
  iconEye: document.getElementById("icon-eye"),
  iconEyeOff: document.getElementById("icon-eye-off"),

  // Modal Alterar Senha
  changePasswordModal: document.getElementById("change-password-modal"),
  changePasswordForm: document.getElementById("change-password-form"),
  currentPassword: document.getElementById("current-password"),
  newPassword: document.getElementById("new-password"),
  confirmPassword: document.getElementById("confirm-password"),
  changePassError: document.getElementById("change-pass-error"),
  btnCloseChangePassModal: document.getElementById("btn-close-change-pass-modal"),
  
  // Modal de Detalhes
  productDetailModal: document.getElementById("product-detail-modal"),
  btnCloseDetailModal: document.getElementById("btn-close-detail-modal"),
  detailProductImage: document.getElementById("detail-product-image"),
  detailProductCategory: document.getElementById("detail-product-category"),
  detailProductTitle: document.getElementById("detail-product-title"),
  detailProductPriceWholesale: document.getElementById("detail-product-price-wholesale"),
  detailProductPriceSuggested: document.getElementById("detail-product-price-suggested"),
  detailProductDescription: document.getElementById("detail-product-description"),
  btnWhatsappContact: document.getElementById("btn-whatsapp-contact"),
  
  // Modal de Formulário (Cadastro)
  productFormModal: document.getElementById("product-form-modal"),
  btnCloseFormModal: document.getElementById("btn-close-form-modal"),
  formModalTitle: document.getElementById("form-modal-title"),
  productForm: document.getElementById("product-form"),
  productFormId: document.getElementById("product-form-id"),
  productName: document.getElementById("product-name"),
  productPriceWholesale: document.getElementById("product-price-wholesale"),
  productPriceSuggested: document.getElementById("product-price-suggested"),
  productPriceLastPurchase: document.getElementById("product-price-last-purchase"),
  productPriceMarketAvg: document.getElementById("product-price-market-avg"),
  productCategory: document.getElementById("product-category"),
  categoriesDatalist: document.getElementById("categories-datalist"),
  productGender: document.getElementById("product-gender"),
  btnGenderMasc: document.getElementById("btn-gender-masc"),
  btnGenderFem: document.getElementById("btn-gender-fem"),
  productDesc: document.getElementById("product-desc"),
  btnCancelForm: document.getElementById("btn-cancel-form"),
  
  // Busca de Imagens
  btnSearchImages: document.getElementById("btn-search-images"),
  imageSearchPanel: document.getElementById("image-search-panel"),
  imageSearchResults: document.getElementById("image-search-results"),
  pexelsKeySection: document.getElementById("pexels-key-section"),
  pexelsApiKeyInput: document.getElementById("pexels-api-key-input"),
  btnSavePexelsKey: document.getElementById("btn-save-pexels-key"),

  // Zona de Upload de Imagem
  imageUploadZone: document.getElementById("image-upload-zone"),
  productImageFile: document.getElementById("product-image-file"),
  uploadPreviewContainer: document.getElementById("upload-preview-container"),
  imagePreviewElement: document.getElementById("image-preview-element"),
  btnRemovePreview: document.getElementById("btn-remove-preview"),
  
  // Toast
  toastContainer: document.getElementById("toast-container")
};

// ==========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializa o tema salvo no localStorage ou padrão escuro (dark)
  initTheme();
  
  // Inicializa banco de dados e carrega dados
  try {
    await CatalogDB.init();
    await loadProductsData();
  } catch (error) {
    console.error("Falha ao inicializar o banco de dados:", error);
    showToast("Erro ao conectar com o banco de dados local.", "error");
  }

  // Configura Event Listeners
  setupEventListeners();
  
  // Inicializa ícones Lucide
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});

// Carrega os produtos do banco e atualiza a UI
async function loadProductsData() {
  try {
    clearObjectUrlCache();
    allProducts = await CatalogDB.getAll();
    updateCategoriesDatalist();
    applyFiltersAndRender();
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    showToast("Erro ao carregar dados dos produtos.", "error");
  }
}

// Libera da memória as URLs temporárias criadas para os Blobs dos produtos
function clearObjectUrlCache() {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrlCache.clear();
}

// ==========================================
// GERENCIAMENTO DE TEMAS (DARK / LIGHT)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcons(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcons(newTheme);
  showToast(`Modo ${newTheme === "dark" ? "Escuro" : "Claro"} ativado`, "success");
}

function updateThemeIcons(theme) {
  if (theme === "dark") {
    dom.themeIconSun.style.display = "block";
    dom.themeIconMoon.style.display = "none";
  } else {
    dom.themeIconSun.style.display = "none";
    dom.themeIconMoon.style.display = "block";
  }
}

// ==========================================
// LOGICA DE FILTRAGEM, ORDENAÇÃO E BUSCA
// ==========================================
function applyFiltersAndRender() {
  // 1. Filtrar por Categoria
  if (currentCategory === "all") {
    filteredProducts = [...allProducts];
  } else {
    filteredProducts = allProducts.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
  }

  // 1b. Filtrar por Gênero
  if (currentGender !== "all") {
    filteredProducts = filteredProducts.filter(p => (p.gender || "") === currentGender);
  }

  // 2. Filtrar por Busca Textual
  if (currentSearch.trim() !== "") {
    const searchLower = currentSearch.toLowerCase();
    filteredProducts = filteredProducts.filter(
      p => p.name.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower)
    );
  }

  // 3. Aplicar Ordenação
  if (currentSort === "price-asc") {
    filteredProducts.sort((a, b) => a.priceWholesale - b.priceWholesale);
  } else if (currentSort === "price-desc") {
    filteredProducts.sort((a, b) => b.priceWholesale - a.priceWholesale);
  } else if (currentSort === "name-asc") {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === "name-desc") {
    filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
  }

  // Renderizar
  renderCatalogGrid();
  renderCategoryTabs();
  renderGenderTabs();
  
  if (dom.adminView.style.display !== "none") {
    renderAdminProductsList();
  }
}

// Retorna uma URL utilizável para a imagem do produto (Blob ou URL string)
function getProductImageUrl(product) {
  const image = product ? product.image : null;
  if (!image) {
    return "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80"; // fallback padrão
  }
  
  // Se for uma instância de Blob/File, cria ou usa do cache um ObjectURL
  if (image instanceof Blob || image instanceof File) {
    if (product.id && objectUrlCache.has(product.id)) {
      return objectUrlCache.get(product.id);
    }
    const url = URL.createObjectURL(image);
    if (product.id) {
      objectUrlCache.set(product.id, url);
    }
    return url;
  }
  
  // Se for string base64 ou URL comum externa
  return image;
}

// Formata valor monetário para Real brasileiro
function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

// Renderiza a grade de produtos do catálogo
function renderCatalogGrid() {
  dom.productGrid.innerHTML = "";

  if (filteredProducts.length === 0) {
    dom.productGrid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="package-search"></i>
        <h3>Nenhum produto encontrado</h3>
        <p>Experimente mudar a categoria ou refinar sua busca por palavras-chave.</p>
      </div>
    `;
    if (typeof lucide !== "undefined") lucide.createIcons();
    return;
  }

  filteredProducts.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card" + (product.unavailable ? " product-unavailable" : "");
    card.setAttribute("data-id", product.id);

    const imageUrl = getProductImageUrl(product);
    const unavailableBadge = product.unavailable
      ? `<div class="unavailable-overlay"><span class="unavailable-badge"><i data-lucide="ban" style="width:14px;height:14px;"></i> Indisponível</span></div>`
      : "";
    const genderBadge = product.gender
      ? `<span class="product-gender-tag product-gender-tag--${product.gender === 'Masculino' ? 'masc' : 'fem'}">${product.gender === 'Masculino' ? '♂' : '♀'} ${product.gender}</span>`
      : "";

    card.innerHTML = `
      <div class="product-card-image-wrapper">
        <span class="product-category-tag">${escapeHTML(product.category)}</span>
        ${genderBadge}
        <img src="${imageUrl}" alt="${escapeHTML(product.name)}" class="product-card-image" loading="lazy">
        ${unavailableBadge}
      </div>
      <div class="product-card-content">
        <h3 class="product-card-title">${escapeHTML(product.name)}</h3>
        <p class="product-card-desc">${escapeHTML(product.description)}</p>
        <div class="product-card-footer" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
            <span>Atacado:</span>
            <span style="color: var(--text-main); font-weight: 800;">${formatPrice(product.priceWholesale)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
            <span>Sug. Venda:</span>
            <span style="color: var(--accent); font-weight: 800;">${formatPrice(product.priceSuggested)}</span>
          </div>
          ${product.unavailable
            ? `<button class="btn btn-secondary btn-sm" disabled style="width: 100%; justify-content: center; margin-top: 0.25rem; opacity: 0.7; cursor: not-allowed;">
                 <i data-lucide="ban" style="width: 16px; height: 16px;"></i> Produto Indisponível
               </button>`
            : `<button class="btn btn-primary btn-sm view-details-btn" data-id="${product.id}" style="width: 100%; justify-content: center; margin-top: 0.25rem;">
                 <i data-lucide="eye" style="width: 16px; height: 16px;"></i> Detalhes
               </button>`}
        </div>
      </div>
    `;

    if (!product.unavailable) {
      // Evento de clique para abrir detalhes
      card.querySelector(".view-details-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openProductDetails(product.id);
      });

      // Clicar em qualquer parte do card também abre detalhes
      card.addEventListener("click", () => {
        openProductDetails(product.id);
      });
    }

    dom.productGrid.appendChild(card);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Renderiza os botões/pílulas de categoria dinamicamente
function renderCategoryTabs() {
  const uniqueCategories = ["all", ...new Set(allProducts.map(p => p.category.trim()))];
  dom.categoriesTabs.innerHTML = "";

  uniqueCategories.forEach(cat => {
    const button = document.createElement("button");
    button.className = `category-tab ${currentCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`;
    button.setAttribute("data-category", cat);
    button.textContent = cat === "all" ? "Todos" : cat;
    button.addEventListener("click", () => {
      currentCategory = cat;
      applyFiltersAndRender();
    });
    dom.categoriesTabs.appendChild(button);
  });
}

// Renderiza os botões de filtro por gênero
function renderGenderTabs() {
  if (!dom.genderTabs) return;
  dom.genderTabs.innerHTML = "";

  const options = [
    { value: "all",       label: "Todos" },
    { value: "Masculino", label: "\u2642 Masculino" },
    { value: "Feminino",  label: "\u2640 Feminino" }
  ];

  options.forEach(opt => {
    const button = document.createElement("button");
    button.className = `gender-filter-tab gender-filter-tab--${opt.value.toLowerCase()} ${currentGender === opt.value ? "active" : ""}`;
    button.setAttribute("data-gender", opt.value);
    button.textContent = opt.label;
    button.addEventListener("click", () => {
      currentGender = opt.value;
      applyFiltersAndRender();
    });
    dom.genderTabs.appendChild(button);
  });
}

// Atualiza o Datalist com categorias existentes para facilitar no cadastro
function updateCategoriesDatalist() {
  const uniqueCategories = [...new Set(allProducts.map(p => p.category.trim()))];
  dom.categoriesDatalist.innerHTML = "";
  
  uniqueCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    dom.categoriesDatalist.appendChild(option);
  });
}

// ==========================================
// RENDERIZAÇÃO DO PAINEL ADMIN
// ==========================================
function renderAdminProductsList() {
  dom.adminProductsList.innerHTML = "";

  if (allProducts.length === 0) {
    dom.adminProductsList.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
          Nenhum produto cadastrado no momento. Clique em "Novo Produto" para adicionar.
        </td>
      </tr>
    `;
    return;
  }

  allProducts.forEach(product => {
    const tr = document.createElement("tr");
    const imageUrl = getProductImageUrl(product);

    tr.innerHTML = `
      <td><img src="${imageUrl}" alt="${escapeHTML(product.name)}" class="admin-prod-thumb"></td>
      <td style="font-weight: 700;">${escapeHTML(product.name)}${product.unavailable ? ' <span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; background: var(--danger); color:#fff; margin-left:6px; vertical-align:middle;">INDISPONÍVEL</span>' : ''}</td>
      <td><span class="product-category-tag" style="position: static; font-size: 0.7rem;">${escapeHTML(product.category)}</span></td>
      <td style="font-weight: 600;">${formatPrice(product.priceWholesale)}</td>
      <td style="font-weight: 600; color: var(--accent);">${formatPrice(product.priceSuggested)}</td>
      <td>
        <div class="admin-actions">
          <button class="btn btn-secondary btn-icon-only btn-toggle-unavail" data-id="${product.id}" title="${product.unavailable ? 'Marcar como disponível' : 'Marcar como indisponível'}" style="${product.unavailable ? 'border-color: var(--danger); color: var(--danger);' : ''}">
            <i data-lucide="${product.unavailable ? 'check-circle' : 'ban'}" style="width: 16px; height: 16px;"></i>
          </button>
          <button class="btn btn-secondary btn-icon-only btn-edit" data-id="${product.id}" title="Editar Produto">
            <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
          </button>
          <button class="btn btn-danger btn-icon-only btn-delete" data-id="${product.id}" title="Excluir Produto">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </td>
    `;

    // Eventos dos botões de ação
    tr.querySelector(".btn-edit").addEventListener("click", () => openProductForm(product.id));
    tr.querySelector(".btn-delete").addEventListener("click", () => handleDeleteProduct(product.id));
    tr.querySelector(".btn-toggle-unavail").addEventListener("click", () => handleToggleUnavailable(product.id));

    dom.adminProductsList.appendChild(tr);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ==========================================
// VISUALIZAÇÃO DE DETALHES (MODAL)
// ==========================================
async function openProductDetails(id) {
  try {
    const product = await CatalogDB.getById(id);
    if (!product) return;

    const imageUrl = getProductImageUrl(product);
    
    dom.detailProductImage.src = imageUrl;
    dom.detailProductImage.alt = product.name;
    dom.detailProductCategory.textContent = product.category;
    dom.detailProductTitle.textContent = product.name;
    dom.detailProductPriceWholesale.textContent = formatPrice(product.priceWholesale);
    dom.detailProductPriceSuggested.textContent = formatPrice(product.priceSuggested);
    dom.detailProductDescription.textContent = product.description;

    // Configura o link do WhatsApp com mensagem personalizada
    const textMsg = `Olá! Vi o produto *${product.name}* (Atacado: ${formatPrice(product.priceWholesale)} / Sugestão: ${formatPrice(product.priceSuggested)}) no catálogo da GS2 Imports e gostaria de mais informações.`;
    dom.btnWhatsappContact.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(textMsg)}`;

    dom.productDetailModal.classList.add("active");
  } catch (error) {
    console.error("Erro ao carregar detalhes:", error);
    showToast("Não foi possível carregar as informações do produto.", "error");
  }
}

function closeProductDetails() {
  dom.productDetailModal.classList.remove("active");
  
  // Limpa imagem ao fechar para evitar flicker visual na próxima abertura
  setTimeout(() => {
    dom.detailProductImage.src = "";
  }, 200);
}

// ==========================================
// FORMULÁRIO DE CADASTRO / EDIÇÃO (ADMIN)
// ==========================================
async function openProductForm(id = null) {
  resetForm();
  
  if (id) {
    // Modo Edição
    try {
      const product = await CatalogDB.getById(id);
      if (!product) return;

      dom.formModalTitle.textContent = "Editar Produto";
      dom.productFormId.value = product.id;
      dom.productName.value = product.name;
      dom.productPriceWholesale.value = product.priceWholesale;
      dom.productPriceSuggested.value = product.priceSuggested;
      dom.productPriceLastPurchase.value = product.priceLastPurchase ?? "";
      dom.productPriceMarketAvg.value = product.priceMarketAvg ?? "";
      dom.productCategory.value = product.category;
      dom.productDesc.value = product.description;
      setGender(product.gender || "");

      // Exibe preview da imagem atual
      if (product.image) {
        const imageUrl = getProductImageUrl(product);
        dom.imagePreviewElement.src = imageUrl;
        dom.imageUploadZone.style.display = "none";
        dom.uploadPreviewContainer.style.display = "block";
        // Mantém a imagem atual vinculada se o usuário não fizer upload de outra
        uploadedImageFile = product.image; 
      }
    } catch (error) {
      console.error("Erro ao carregar produto para edição:", error);
      showToast("Erro ao abrir formulário de edição.", "error");
      return;
    }
  } else {
    // Modo Criação
    dom.formModalTitle.textContent = "Adicionar Novo Produto";
  }

  dom.productFormModal.classList.add("active");
}

function closeProductForm() {
  dom.productFormModal.classList.remove("active");
  resetForm();
}

function setGender(value) {
  dom.productGender.value = value;
  dom.btnGenderMasc.classList.toggle("active", value === "Masculino");
  dom.btnGenderFem.classList.toggle("active", value === "Feminino");
}

function resetForm() {
  dom.productForm.reset();
  dom.productFormId.value = "";
  setGender("");
  uploadedImageFile = null;
  
  // Libera ObjectURL da memória para evitar vazamento
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }
  
  dom.imagePreviewElement.src = "";
  dom.imageUploadZone.style.display = "flex";
  dom.uploadPreviewContainer.style.display = "none";
  dom.productImageFile.value = "";
}

// Manipulação do arquivo de Imagem
function handleImageSelection(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Por favor, selecione apenas arquivos de imagem válida.", "error");
    return;
  }

  uploadedImageFile = file;

  // Cria preview local na tela
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = URL.createObjectURL(file);
  dom.imagePreviewElement.src = currentPreviewUrl;
  
  // Troca a exibição da zona de drag-drop pelo preview
  dom.imageUploadZone.style.display = "none";
  dom.uploadPreviewContainer.style.display = "block";
}

function removeSelectedImage() {
  uploadedImageFile = null;
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }
  dom.imagePreviewElement.src = "";
  dom.productImageFile.value = "";
  dom.imageUploadZone.style.display = "flex";
  dom.uploadPreviewContainer.style.display = "none";
}

// ==========================================
// BUSCA AUTOMÁTICA DE IMAGENS (PEXELS API)
// ==========================================
const PEXELS_KEY_STORAGE = "gs2_pexels_api_key";

function getPexelsKey() {
  return localStorage.getItem(PEXELS_KEY_STORAGE) || "";
}

function savePexelsKey() {
  const key = dom.pexelsApiKeyInput.value.trim();
  if (!key) {
    showToast("Cole sua chave da API do Pexels.", "error");
    return;
  }
  localStorage.setItem(PEXELS_KEY_STORAGE, key);
  dom.pexelsKeySection.style.display = "none";
  showToast("Chave salva! Buscando imagens...", "success");
  const name = dom.productName.value.trim();
  doImageSearch(name, key);
}

async function searchProductImages() {
  const productName = dom.productName.value.trim();
  if (!productName) {
    showToast("Digite o nome do produto antes de buscar imagens.", "error");
    return;
  }

  const apiKey = getPexelsKey();
  dom.imageSearchPanel.style.display = "block";

  if (!apiKey) {
    dom.pexelsKeySection.style.display = "block";
    dom.imageSearchResults.innerHTML = "";
    return;
  }

  await doImageSearch(productName, apiKey);
}

async function doImageSearch(query, apiKey) {
  dom.pexelsKeySection.style.display = "none";
  dom.imageSearchResults.innerHTML = `
    <div class="img-search-loading">
      <i data-lucide="loader-2" class="img-search-spinner"></i>
      <span>Buscando imagens para <em>${escapeHTML(query)}</em>...</span>
    </div>`;
  if (typeof lucide !== "undefined") lucide.createIcons();

  // Usa o nome do produto como query; adiciona "perfume" se não estiver lá
  const searchTerm = /perfume|fragr|eau de|cologne/i.test(query) ? query : query + " perfume";

  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=12&orientation=square`,
      { headers: { Authorization: apiKey } }
    );

    if (resp.status === 401) {
      localStorage.removeItem(PEXELS_KEY_STORAGE);
      dom.imageSearchResults.innerHTML = `<p class="img-search-msg img-search-msg--error">❌ Chave de API inválida. Por favor, insira uma chave válida.</p>`;
      dom.pexelsKeySection.style.display = "block";
      return;
    }
    if (!resp.ok) throw new Error("Erro na requisição");

    const data = await resp.json();
    renderImageSearchResults(data.photos, query);
  } catch (err) {
    dom.imageSearchResults.innerHTML = `<p class="img-search-msg img-search-msg--error">⚠️ Falha ao buscar imagens. Verifique sua conexão e tente novamente.</p>`;
  }
}

function renderImageSearchResults(photos, query) {
  if (!photos || photos.length === 0) {
    dom.imageSearchResults.innerHTML = `<p class="img-search-msg">Nenhuma imagem encontrada para "${escapeHTML(query)}". Tente ajustar o nome do produto.</p>`;
    return;
  }

  dom.imageSearchResults.innerHTML = `<p class="img-search-header">Clique em uma imagem para selecionar (${photos.length} resultados)</p>`;

  const grid = document.createElement("div");
  grid.className = "img-search-grid";

  photos.forEach(photo => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-search-item";

    const img = document.createElement("img");
    img.src = photo.src.medium;
    img.alt = photo.alt || "Imagem do produto";
    img.loading = "lazy";
    img.title = "Clique para selecionar";

    wrapper.appendChild(img);
    wrapper.addEventListener("click", () => selectSearchImage(photo.src.large2x || photo.src.large, photo.alt || ""));
    grid.appendChild(wrapper);
  });

  dom.imageSearchResults.appendChild(grid);
}

function selectSearchImage(url, alt) {
  // Armazena a URL como string (já suportado pelo getProductImageUrl)
  uploadedImageFile = url;
  dom.imagePreviewElement.src = url;
  dom.imagePreviewElement.alt = alt;
  dom.imageUploadZone.style.display = "none";
  dom.uploadPreviewContainer.style.display = "block";
  dom.imageSearchPanel.style.display = "none";
  showToast("Imagem selecionada com sucesso!", "success");
}

// Ação de Salvar Formulário
async function handleFormSubmit(event) {
  event.preventDefault();

  const id = dom.productFormId.value ? Number(dom.productFormId.value) : null;
  const name = dom.productName.value.trim();
  const priceWholesale = parseFloat(dom.productPriceWholesale.value);
  const priceSuggested = parseFloat(dom.productPriceSuggested.value);
  const priceLastPurchaseRaw = dom.productPriceLastPurchase.value;
  const priceMarketAvgRaw = dom.productPriceMarketAvg.value;
  const priceLastPurchase = priceLastPurchaseRaw === "" ? null : parseFloat(priceLastPurchaseRaw);
  const priceMarketAvg = priceMarketAvgRaw === "" ? null : parseFloat(priceMarketAvgRaw);
  const category = dom.productCategory.value.trim();
  const gender = dom.productGender.value || null;
  const description = dom.productDesc.value.trim();

  if (!uploadedImageFile) {
    showToast("Por favor, envie uma foto do produto.", "error");
    return;
  }

  const productData = {
    name,
    priceWholesale,
    priceSuggested,
    priceLastPurchase,
    priceMarketAvg,
    category,
    gender,
    description,
    image: uploadedImageFile // Armazena o Blob binário nativo ou link padrão
  };

  if (id) {
    productData.id = id;
  }

  try {
    await CatalogDB.save(productData);
    showToast(id ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!", "success");
    closeProductForm();
    await loadProductsData();
  } catch (error) {
    console.error("Erro ao salvar produto:", error);
    showToast("Falha ao salvar produto. Tente novamente.", "error");
  }
}

// Ação de Excluir Produto
async function handleDeleteProduct(id) {
  const confirmed = confirm("Tem certeza que deseja excluir permanentemente este produto?");
  if (!confirmed) return;

  try {
    await CatalogDB.delete(id);
    showToast("Produto excluído com sucesso!", "success");
    await loadProductsData();
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    showToast("Falha ao excluir produto do banco local.", "error");
  }
}

// Alterna estado de disponibilidade do produto
async function handleToggleUnavailable(id) {
  try {
    const product = await CatalogDB.getById(id);
    if (!product) return;
    product.unavailable = !product.unavailable;
    await CatalogDB.save(product);
    showToast(product.unavailable ? "Produto marcado como indisponível." : "Produto marcado como disponível.", "success");
    await loadProductsData();
  } catch (error) {
    console.error("Erro ao alternar disponibilidade:", error);
    showToast("Falha ao atualizar disponibilidade.", "error");
  }
}


async function handleResetCatalog() {
  const confirmed = confirm("Tem certeza que deseja restaurar o catálogo padrão de perfumes? Isso apagará todos os itens cadastrados localmente.");
  if (!confirmed) return;

  try {
    await CatalogDB.reset();
    showToast("Catálogo de perfumes restaurado!", "success");
    await loadProductsData();
    // Volta para o catálogo se estiver no admin
    if (dom.adminView.style.display !== "none") {
      toggleAdminView();
    }
  } catch (error) {
    console.error("Erro ao restaurar catálogo:", error);
    showToast("Falha ao restaurar catálogo padrão.", "error");
  }
}

// ==========================================
// TOAST NOTIFICATIONS SYSTEM
// ==========================================
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "check-circle";
  if (type === "error") icon = "alert-triangle";
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;

  dom.toastContainer.appendChild(toast);
  
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // Remove o toast após 3 segundos
  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s reverse forwards";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ==========================================
// ALTERNAÇÃO DE VISÕES (CLIENTE VS ADMIN)
// ==========================================
function switchToAdminView() {
  dom.catalogView.style.display = "none";
  dom.adminView.style.display   = "block";
  dom.searchContainer.style.visibility = "hidden";

  dom.adminViewToggleBtn.classList.remove("btn-secondary");
  dom.adminViewToggleBtn.classList.add("btn-primary");
  dom.adminViewToggleBtn.innerHTML = `<i data-lucide="eye"></i> <span>Ver Catálogo</span>`;

  renderAdminProductsList();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function switchToCatalogView() {
  dom.adminView.style.display   = "none";
  dom.catalogView.style.display = "block";
  dom.searchContainer.style.visibility = "visible";

  dom.adminViewToggleBtn.classList.remove("btn-primary");
  dom.adminViewToggleBtn.classList.add("btn-secondary");
  dom.adminViewToggleBtn.innerHTML = `<i data-lucide="settings"></i> <span>Painel Admin</span>`;

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Mantido por compatibilidade com chamadas existentes
function toggleAdminView() {
  if (dom.adminView.style.display === "none") {
    switchToAdminView();
  } else {
    switchToCatalogView();
  }
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
  // Clique no logotipo recarrega/limpa filtros
  dom.logoLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (dom.adminView.style.display !== "none") {
      toggleAdminView();
    }
    currentCategory = "all";
    currentSearch = "";
    dom.searchInput.value = "";
    dom.sortSelect.value = "default";
    currentSort = "default";
    applyFiltersAndRender();
  });

  // Campo de busca
  dom.searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value;
    applyFiltersAndRender();
  });

  // Alternador de Ordenação
  dom.sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFiltersAndRender();
  });

  // Alternador de Tema
  dom.themeToggleBtn.addEventListener("click", toggleTheme);

  // Botão Painel Admin — verifica autenticação antes de abrir
  dom.adminViewToggleBtn.addEventListener("click", () => {
    if (dom.adminView.style.display !== "none") {
      // Já está no admin, volta ao catálogo
      switchToCatalogView();
    } else if (isAdminAuthenticated()) {
      // Já autenticado nesta sessão
      switchToAdminView();
    } else {
      // Pede login
      openAdminLoginModal();
    }
  });

  // Modal de Login Admin
  dom.adminLoginForm.addEventListener("submit", handleAdminLogin);
  dom.btnCloseLoginModal.addEventListener("click", closeAdminLoginModal);

  // Mostrar/ocultar senha no login
  dom.btnTogglePasswordVisibility.addEventListener("click", () => {
    const isPass = dom.adminLoginPassword.type === "password";
    dom.adminLoginPassword.type = isPass ? "text" : "password";
    dom.iconEye.style.display    = isPass ? "none"  : "block";
    dom.iconEyeOff.style.display = isPass ? "block" : "none";
  });

  // Botão Sair (Logout)
  dom.btnAdminLogout.addEventListener("click", () => {
    logoutAdmin();
    switchToCatalogView();
    showToast("Sessão encerrada. Até logo!", "success");
  });

  // Alterar Senha
  dom.btnChangePassword.addEventListener("click", openChangePasswordModal);
  dom.changePasswordForm.addEventListener("submit", handleChangePassword);
  dom.btnCloseChangePassModal.addEventListener("click", closeChangePasswordModal);
  
  // Botão restaurar catálogo padrão
  dom.btnResetDb.addEventListener("click", handleResetCatalog);

  // Botão voltar do painel admin
  dom.btnBackToCatalog.addEventListener("click", switchToCatalogView);

  // Abrir Modal de Cadastro de Produto
  dom.btnAddProduct.addEventListener("click", () => openProductForm());

  // Fechar Modal de Cadastro de Produto
  dom.btnCloseFormModal.addEventListener("click", closeProductForm);
  dom.btnCancelForm.addEventListener("click", closeProductForm);

  // Botoes de Gênero
  dom.btnGenderMasc.addEventListener("click", () => {
    const current = dom.productGender.value;
    setGender(current === "Masculino" ? "" : "Masculino"); // toggle
  });
  dom.btnGenderFem.addEventListener("click", () => {
    const current = dom.productGender.value;
    setGender(current === "Feminino" ? "" : "Feminino"); // toggle
  });

  // Fechar Modal de Detalhes do Produto
  dom.btnCloseDetailModal.addEventListener("click", closeProductDetails);

  // Submissão do Formulário
  dom.productForm.addEventListener("submit", handleFormSubmit);

  // Auto-calcular Valor Atacado = Último Preço de Compra + 10%
  dom.productPriceLastPurchase.addEventListener("input", () => {
    const last = parseFloat(dom.productPriceLastPurchase.value);
    if (!isNaN(last) && last > 0) {
      dom.productPriceWholesale.value = (last * 1.10).toFixed(2);
    }
  });

  // Lógica de Envio de Arquivo / Upload por Clique
  dom.productImageFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageSelection(e.target.files[0]);
    }
  });

  // Busca automática de imagens
  dom.btnSearchImages.addEventListener("click", searchProductImages);
  dom.btnSavePexelsKey.addEventListener("click", savePexelsKey);

  // Remover Preview de Imagem
  dom.btnRemovePreview.addEventListener("click", removeSelectedImage);

  // Drag and Drop de Imagem
  dom.imageUploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.imageUploadZone.style.borderColor = "var(--primary)";
    dom.imageUploadZone.style.background = "var(--card-bg)";
  });

  dom.imageUploadZone.addEventListener("dragleave", () => {
    dom.imageUploadZone.style.borderColor = "var(--card-border)";
    dom.imageUploadZone.style.background = "var(--base-bg)";
  });

  dom.imageUploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.imageUploadZone.style.borderColor = "var(--card-border)";
    dom.imageUploadZone.style.background = "var(--base-bg)";
    
    if (e.dataTransfer.files.length > 0) {
      handleImageSelection(e.dataTransfer.files[0]);
    }
  });

  // Fechar modais ao clicar no overlay de fundo
  window.addEventListener("click", (e) => {
    if (e.target === dom.productDetailModal)  closeProductDetails();
    if (e.target === dom.productFormModal)    closeProductForm();
    if (e.target === dom.adminLoginModal)     closeAdminLoginModal();
    if (e.target === dom.changePasswordModal) closeChangePasswordModal();
  });
}

// ==========================================
// FUNÇÕES AUXILIARES DE SEGURANÇA
// ==========================================
function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
