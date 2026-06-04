const SUPABASE_URL = 'https://miucwnzmglfrgiicobfj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pd49AZcrhdpTkNiHkNBA2g_x5Ncj1Pp';
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CatalogDB = {
  // Adicionamos esta função vazia para resolver o erro do app.js
  async init() { 
    return Promise.resolve(); 
  },

  async getAll() {
    const { data, error } = await sbClient.from('products').select('*');
    if (error) { console.error("Erro ao buscar:", error); return []; }
    return data;
  },

  async save(product) {
    const { data, error } = await sbClient.from('products').upsert(product).select();
    if (error) { console.error("Erro ao salvar:", error); throw error; }
    return data;
  },

  async delete(id) {
    const { error } = await sbClient.from('products').delete().eq('id', id);
    if (error) { console.error("Erro ao deletar:", error); throw error; }
  }
};