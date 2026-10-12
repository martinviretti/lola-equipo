import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_CLAVE_PUBLICA } from './supabase-config';

/** Hay proyecto de Supabase cargado: la app pide login. */
export const configurado = Boolean(SUPABASE_URL && SUPABASE_CLAVE_PUBLICA);

export const supabase: SupabaseClient | null = configurado
  ? createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null;
