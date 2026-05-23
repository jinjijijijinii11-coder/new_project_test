import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =====================================================================
// Database 타입 (Supabase generate types 로 자동 생성 가능)
// =====================================================================
export type Database = {
  public: {
    Tables: {
      hospitals: {
        Row: {
          id: string
          name: string
          type: string
          region: string
          district: string
          beds: number
          established_year: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['hospitals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['hospitals']['Insert']>
      }
      hospital_stats: {
        Row: {
          id: string
          hospital_id: string
          year: number
          month: number
          outpatient_count: number
          inpatient_count: number
          surgery_count: number
          revenue: number
          avg_stay_days: number
          bed_occupancy_rate: number
          medical_staff_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['hospital_stats']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['hospital_stats']['Insert']>
      }
    }
  }
}
