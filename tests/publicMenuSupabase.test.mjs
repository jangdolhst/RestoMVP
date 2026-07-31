import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const supabaseClientSource = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const posContextSource = readFileSync(new URL('../src/context/POSContext.jsx', import.meta.url), 'utf8');
const clientePageSource = readFileSync(new URL('../src/pages/ClientePage.jsx', import.meta.url), 'utf8');

test('public menu uses a Supabase client without persisted business session', () => {
  assert.match(supabaseClientSource, /export const publicSupabase = createClient/);
  assert.match(supabaseClientSource, /persistSession:\s*false/);
  assert.match(supabaseClientSource, /autoRefreshToken:\s*false/);
  assert.match(supabaseClientSource, /detectSessionInUrl:\s*false/);
  assert.match(supabaseClientSource, /storageKey:\s*'jamm-free-public-anon'/);
});

test('client menu reads and creates public orders through the anonymous client', () => {
  assert.match(posContextSource, /import \{ publicSupabase, supabase \} from '..\/lib\/supabase'/);
  assert.match(posContextSource, /const dataClient = isClientMenu \? publicSupabase : supabase/);
  assert.match(posContextSource, /publicSupabase\.rpc\('create_public_order'/);
  assert.match(clientePageSource, /import \{ publicSupabase \} from '..\/lib\/supabase'/);
  assert.match(clientePageSource, /publicSupabase\s*\n\s*\.from\('restaurant_profiles'\)/);
});
