import { createClient } from '@supabase/supabase-js';

const url = 'https://kvwrvyjxywlevpntrvca.supabase.co';
const key = 'sb_publishable_FB7FPCYyD94UorCUmSm83A_rNK1WmQB';
const supabase = createClient(url, key);

async function inspectAll() {
  console.log('--- Inspecting Database ---');

  // Let's query advance_bookings
  const { data: bookings } = await supabase.from('advance_bookings').select('*');
  console.log('Advance Bookings:', bookings);

  // Let's query tenancies
  const { data: tenancies } = await supabase.from('tenancies').select('*, tenants(*), beds(*, rooms(*))');
  console.log('Tenancies:', JSON.stringify(tenancies, null, 2));

  // Let's query payments
  const { data: payments } = await supabase.from('payments').select('*, tenancies(*, tenants(*))');
  console.log('Payments:', JSON.stringify(payments, null, 2));
}

inspectAll();
