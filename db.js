
// ==========================================
// GS2 IMPORTS — BANCO DE DADOS LOCAL (IndexedDB)
// ==========================================
const CatalogDB = (() => {
  const DB_NAME    = "gs2imports_db";
  const DB_VERSION = 1;
  const STORE_NAME = "products";
  let dbInstance   = null;

  // Abre (ou reutiliza) a conexão com o banco
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror   = (e) => reject(e.target.error);
    });
  }

  async function getDB() {
    if (!dbInstance) dbInstance = await openDB();
    return dbInstance;
  }

  // Conta os registros na store
  async function countRecords() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  return {

    // Inicializa e popula com dados padrão se o banco estiver vazio
    async init() {
      const count = await countRecords();
      if (count === 0 && typeof INITIAL_PRODUCTS !== "undefined") {
        await this.reset();
      }
    },

    // Retorna todos os produtos
    async getAll() {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    },

    // Retorna um produto pelo ID
    async getById(id) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(Number(id));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => reject(req.error);
      });
    },

    // Salva (insere ou atualiza) um produto
    async save(product) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        // Se tem ID, faz PUT (atualizar); senão, ADD (inserir)
        const req   = product.id ? store.put(product) : store.add(product);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    },

    // Deleta um produto pelo ID
    async delete(id) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).delete(Number(id));
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
      });
    },

    // Limpa o banco e reinsere os produtos padrão
    async reset() {
      const db = await getDB();

      // Apaga tudo
      await new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
      });

      // Reinsere produtos iniciais (sem ID para autoIncrement funcionar)
      if (typeof INITIAL_PRODUCTS !== "undefined") {
        for (const p of INITIAL_PRODUCTS) {
          const { id, ...productWithoutId } = p;
          await this.save({ ...productWithoutId });
        }
      }
    }
  };
})();
