// =====================================================================
// 병원 관련 타입 정의
// Supabase 테이블 스키마와 1:1 매핑
// =====================================================================

export type HospitalType = '상급종합' | '종합병원' | '병원' | '의원' | '요양병원'

export interface Hospital {
  id: string
  name: string
  type: HospitalType
  region: string          // 시도
  district: string        // 시군구
  beds: number            // 병상 수
  established_year: number
  created_at: string
  updated_at: string
}

export interface HospitalStats {
  id: string
  hospital_id: string
  year: number
  month: number
  outpatient_count: number   // 외래 환자 수
  inpatient_count: number    // 입원 환자 수
  surgery_count: number      // 수술 건수
  revenue: number            // 매출액 (만원)
  avg_stay_days: number      // 평균 재원일수
  bed_occupancy_rate: number // 병상 가동률 (%)
  medical_staff_count: number // 의료 인력 수
  created_at: string
}

// =====================================================================
// 집계/분석용 타입
// =====================================================================

export interface GroupSummary {
  type: HospitalType
  hospital_count: number
  total_beds: number
  avg_beds: number
  avg_outpatient: number
  avg_inpatient: number
  avg_revenue: number
  avg_bed_occupancy: number
  avg_stay_days: number
}

export interface MonthlyTrend {
  year: number
  month: number
  label: string            // "2024-01" 형식
  [key: string]: number | string  // 병원 타입별 값
}

export interface RegionDistribution {
  region: string
  count: number
  percentage: number
}

export interface ComparisonMetric {
  metric: string
  label: string
  unit: string
  [hospitalType: string]: string | number
}

// =====================================================================
// 필터/UI 상태 타입
// =====================================================================

export type MetricKey =
  | 'outpatient_count'
  | 'inpatient_count'
  | 'surgery_count'
  | 'revenue'
  | 'avg_stay_days'
  | 'bed_occupancy_rate'

export interface DashboardFilters {
  year: number
  selectedTypes: HospitalType[]
  selectedRegions: string[]
  metric: MetricKey
}

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: string }> = {
  outpatient_count:   { label: '외래 환자 수',   unit: '명' },
  inpatient_count:    { label: '입원 환자 수',   unit: '명' },
  surgery_count:      { label: '수술 건수',      unit: '건' },
  revenue:            { label: '매출액',         unit: '만원' },
  avg_stay_days:      { label: '평균 재원일수',   unit: '일' },
  bed_occupancy_rate: { label: '병상 가동률',     unit: '%' },
}

export const HOSPITAL_TYPE_COLORS: Record<HospitalType, string> = {
  '상급종합': '#3b82f6',
  '종합병원': '#10b981',
  '병원':     '#f59e0b',
  '의원':     '#8b5cf6',
  '요양병원': '#ef4444',
}

export const HOSPITAL_TYPES: HospitalType[] = [
  '상급종합', '종합병원', '병원', '의원', '요양병원',
]

export const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산',
  '세종', '경기', '강원', '충북', '충남', '전북', '전남',
  '경북', '경남', '제주',
]
