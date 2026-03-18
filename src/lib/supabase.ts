import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zbbachjfmcmzunbsovps.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_ZIzbTj2_ublphkaFYnV8Fg_I9XVwD-t'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
