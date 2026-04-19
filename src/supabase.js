import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qbmiuontydxmfygxoavr.supabase.co'
const supabaseKey = 'sb_publishable_L6owBhARwIITj5-QOOe94g_kPcnqsLU'

export const supabase = createClient(supabaseUrl, supabaseKey)