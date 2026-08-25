import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup rather than with a confusing error deep in
  // some auth call later -- easier to debug when first setting this up.
  throw new Error(
    'Missing Supabase credentials. Copy .env.example to .env.local and ' +
    'fill in your project URL and anon key from the Supabase dashboard.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
