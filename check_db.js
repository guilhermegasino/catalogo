const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://miucwnzmglfrgiicobfj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pd49AZcrhdpTkNiHkNBA2g_x5Ncj1Pp';
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await sbClient.from('products').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}
check();
