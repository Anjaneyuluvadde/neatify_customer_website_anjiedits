import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else {
    console.log("Coupons schema sample data:");
    console.log(data);
  }
}

main();
