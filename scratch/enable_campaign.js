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
    .from('offers')
    .update({ is_offer_enabled: true })
    .eq('service_type', 'NEW_USER_WELCOME')
    .select();

  if (error) {
    console.error(error);
  } else {
    console.log("Successfully enabled the campaign in database:");
    console.log(data);
  }
}

main();
