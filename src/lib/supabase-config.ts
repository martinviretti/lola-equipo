// Datos públicos del proyecto de Supabase (Project Settings → API).
// La clave pública ("publishable" o "anon") está hecha para ir en la app: la protección
// está en las reglas de la base (supabase/schema.sql). Nunca poner acá la "secret" ni la "service_role".
// Mientras estén vacías, la app funciona como antes: sin login.
// PUBLIC_SUPABASE_URL_PRUEBA solo se usa en builds de prueba con datos inventados (nunca en producción).
// PUBLIC_SIN_LOGIN=1 lo usa solo `npm run pdf`: el navegador que imprime no tiene sesión.
export const SUPABASE_URL: string = import.meta.env.PUBLIC_SIN_LOGIN
  ? ''
  : import.meta.env.PUBLIC_SUPABASE_URL_PRUEBA || 'https://paoaxlomsbybauciiody.supabase.co';
export const SUPABASE_CLAVE_PUBLICA = 'sb_publishable_nqgTELFmH81TB_mjJJGULA_rGiyk5Pu';
