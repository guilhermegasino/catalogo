const SUPABASE_URL = 'https://miucwnzmglfrgiicobfj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pd49AZcrhdpTkNiHkNBA2g_x5Ncj1Pp';
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Campos que NÃO existem como colunas no Supabase — devem ser removidos antes do upsert
function cleanProductForDB(product) {
  const clean = { ...product };
  // Remove campos camelCase duplicados (o Supabase usa snake_case)
  delete clean.postedFacebook;
  delete clean.postedInstagram;
  // Remove campos locais que não são colunas do banco
  delete clean.priceHistory;
  return clean;
}

const CatalogDB = {
  async init() {
    return Promise.resolve();
  },

  async getAll() {
    const { data, error } = await sbClient.from('products').select('*');
    if (error) { console.error("Erro ao buscar:", error); return []; }
    return data;
  },

  async save(product) {
    const { data, error } = await sbClient.from('products').upsert(cleanProductForDB(product)).select();
    if (error) { console.error("Erro ao salvar:", error); throw error; }
    return data;
  },

  async update(product) {
    const { data, error } = await sbClient.from('products').upsert(cleanProductForDB(product)).select();
    if (error) { console.error("Erro ao atualizar:", error); throw error; }
    return data;
  },

  async delete(id) {
    const { error } = await sbClient.from('products').delete().eq('id', id);
    if (error) { console.error("Erro ao deletar:", error); throw error; }
  }
};
