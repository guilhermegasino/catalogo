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
    chip.innerHTML = `<span>${brand}</span><button type="button" class="brand-delete-btn">×</button>`;
    chip.querySelector("span").onclick = () => { selectedBrand = (selectedBrand === brand) ? "" : brand; renderBrandButtons(); };
    chip.querySelector("button").onclick = (e) => { e.stopPropagation(); saveBrands(getBrands().filter(b => b !== brand)); renderBrandButtons(); };
    container.appendChild(chip);
  });
}
// Cole este bloco perto de onde estão as outras funções de renderização (ex: logo após renderCatalogGrid)
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
  
  // Define as opções de gênero
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
    btn.onclick = () => { 
      currentGender = gen.id; 
      applyFiltersAndRender(); 
    };
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
  
  renderCatalogGrid();
  renderCategoryTabs();
  renderGenderTabs();
  if (document.getElementById("admin-view").style.display !== "none") renderAdminProductsList();
}

function renderCatalogGrid() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = filteredProducts.length === 0 ? '<div class="empty-state">Nenhum produto encontrado.</div>' : "";
  
  filteredProducts.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card" + (product.unavailable ? " product-unavailable" : "");
    card.innerHTML = `
      <div class="product-card-image-wrapper">
        <img src="${product.image}" alt="${product.name}">
        ${product.unavailable ? '<span class="unavailable-badge">Indisponível</span>' : ''}
      </div>
      <div class="product-card-content">
        <h3>${product.name}</h3>
        <p>Atacado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.priceWholesale)}</p>
        <button class="view-details-btn" onclick="openProductDetails('${product.id}')">Detalhes</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderAdminProductsList() {
  const list = document.getElementById("admin-products-list");
  list.innerHTML = "";
  allProducts.forEach(product => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>${product.priceWholesale}</td>
      <td>
        <button onclick="openProductForm('${product.id}')">Editar</button>
        <button class="btn-danger" onclick="handleDeleteProduct('${product.id}')">Excluir</button>
      </td>
    `;
    list.appendChild(tr);
  });
}

async function handleDeleteProduct(id) {
  if (confirm("Excluir este produto?")) {
    await CatalogDB.delete(id);
    await loadProductsData();
  }
}// ==========================================
// FORMULÁRIO DE PRODUTO E UPLOAD SUPABASE
// ==========================================
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const productData = {
    name: document.getElementById("product-name").value,
    priceWholesale: parseFloat(document.getElementById("product-price-wholesale").value),
    priceSuggested: parseFloat(document.getElementById("product-price-suggested").value),
    category: document.getElementById("product-category").value,
    image: uploadedImageFile // Pode ser o objeto File ou URL
  };

  try {
    // Se o usuário selecionou um arquivo local, fazemos upload para o Storage
    if (uploadedImageFile instanceof File) {
      const fileName = `${Date.now()}_${uploadedImageFile.name}`;
      const { data, error } = await sbClient.storage.from('products').upload(fileName, uploadedImageFile);
      if (error) throw error;
      
      const { data: publicUrlData } = sbClient.storage.from('products').getPublicUrl(fileName);
      productData.image = publicUrlData.publicUrl;
    }

    await CatalogDB.save(productData);
    alert("Produto salvo com sucesso!");
    document.getElementById("product-form-modal").classList.remove("active");
    await loadProductsData();
  } catch (error) {
    console.error("Erro no upload:", error);
    alert("Falha ao salvar produto.");
  }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializa o banco de dados
  await CatalogDB.init();
  
  // Carrega os dados iniciais
  await loadProductsData();

  // Configura Listeners de eventos
  document.getElementById("product-form").addEventListener("submit", handleFormSubmit);
  
  // Input de arquivo para imagem
  document.getElementById("product-image-file").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadedImageFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => { document.getElementById("image-preview-element").src = e.target.result; };
      reader.readAsDataURL(uploadedImageFile);
    }
  });

  console.log("Sistema GS2 Imports inicializado com sucesso.");
});