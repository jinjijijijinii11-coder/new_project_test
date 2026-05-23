// =====================================================================
// 목업 데이터 – Supabase 연결 전 개발/데모용
// =====================================================================
import {
  GroupSummary,
  MonthlyTrend,
  RegionDistribution,
  HospitalType,
  HOSPITAL_TYPES,
} from '@/types/hospital'

// ── 병원군별 요약 ──────────────────────────────────────────────────────
export const MOCK_GROUP_SUMMARY: GroupSummary[] = [
  {
    type: '상급종합',
    hospital_count: 45,
    total_beds: 112_500,
    avg_beds: 2_500,
    avg_outpatient: 38_000,
    avg_inpatient: 1_800,
    avg_revenue: 520_000,
    avg_bed_occupancy: 91.2,
    avg_stay_days: 8.4,
  },
  {
    type: '종합병원',
    hospital_count: 320,
    total_beds: 192_000,
    avg_beds: 600,
    avg_outpatient: 8_200,
    avg_inpatient: 480,
    avg_revenue: 85_000,
    avg_bed_occupancy: 84.7,
    avg_stay_days: 7.1,
  },
  {
    type: '병원',
    hospital_count: 1_460,
    total_beds: 219_000,
    avg_beds: 150,
    avg_outpatient: 1_500,
    avg_inpatient: 120,
    avg_revenue: 18_000,
    avg_bed_occupancy: 72.3,
    avg_stay_days: 12.6,
  },
  {
    type: '의원',
    hospital_count: 34_200,
    total_beds: 0,
    avg_beds: 0,
    avg_outpatient: 580,
    avg_inpatient: 0,
    avg_revenue: 4_200,
    avg_bed_occupancy: 0,
    avg_stay_days: 0,
  },
  {
    type: '요양병원',
    hospital_count: 1_540,
    total_beds: 278_000,
    avg_beds: 180,
    avg_outpatient: 210,
    avg_inpatient: 170,
    avg_revenue: 9_800,
    avg_bed_occupancy: 94.6,
    avg_stay_days: 104.2,
  },
]

// ── 월별 추이 데이터 ──────────────────────────────────────────────────
function generateMonthlyTrend(
  year: number,
  baseValues: Record<HospitalType, number>,
  variance = 0.08,
): MonthlyTrend[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const label = `${year}-${String(month).padStart(2, '0')}`
    const entry: MonthlyTrend = { year, month, label }
    for (const type of HOSPITAL_TYPES) {
      const base = baseValues[type]
      const jitter = 1 + (Math.random() * variance * 2 - variance)
      // 겨울(12,1,2) 성수기 반영
      const seasonal = [12, 1, 2].includes(month) ? 1.08 : month >= 7 && month <= 8 ? 0.94 : 1
      entry[type] = Math.round(base * jitter * seasonal)
    }
    return entry
  })
}

export const MOCK_MONTHLY_OUTPATIENT: MonthlyTrend[] = generateMonthlyTrend(2024, {
  '상급종합': 38_000,
  '종합병원':  8_200,
  '병원':      1_500,
  '의원':        580,
  '요양병원':    210,
})

export const MOCK_MONTHLY_REVENUE: MonthlyTrend[] = generateMonthlyTrend(2024, {
  '상급종합': 520_000,
  '종합병원':  85_000,
  '병원':      18_000,
  '의원':       4_200,
  '요양병원':   9_800,
})

export const MOCK_MONTHLY_BED_OCCUPANCY: MonthlyTrend[] = generateMonthlyTrend(2024, {
  '상급종합':  91,
  '종합병원':  84,
  '병원':       72,
  '의원':        0,
  '요양병원':   94,
}, 0.04)

// ── 지역 분포 ────────────────────────────────────────────────────────
export const MOCK_REGION_DISTRIBUTION: RegionDistribution[] = [
  { region: '서울',  count: 6_420, percentage: 17.2 },
  { region: '경기',  count: 7_850, percentage: 21.0 },
  { region: '부산',  count: 2_180, percentage: 5.8 },
  { region: '대구',  count: 1_540, percentage: 4.1 },
  { region: '인천',  count: 1_680, percentage: 4.5 },
  { region: '광주',  count: 1_120, percentage: 3.0 },
  { region: '대전',  count: 1_050, percentage: 2.8 },
  { region: '울산',  count:   720, percentage: 1.9 },
  { region: '경남',  count: 2_340, percentage: 6.3 },
  { region: '경북',  count: 1_980, percentage: 5.3 },
  { region: '충남',  count: 1_560, percentage: 4.2 },
  { region: '전남',  count: 1_420, percentage: 3.8 },
  { region: '전북',  count: 1_350, percentage: 3.6 },
  { region: '충북',  count: 1_140, percentage: 3.1 },
  { region: '강원',  count: 1_060, percentage: 2.8 },
  { region: '제주',  count:   420, percentage: 1.1 },
  { region: '세종',  count:   550, percentage: 1.5 },
]

// ── KPI 카드 데이터 ──────────────────────────────────────────────────
export const MOCK_KPI = {
  totalHospitals:    { value: 37_565, change: 2.3,  unit: '개소' },
  totalBeds:         { value: 801_500, change: 1.8,  unit: '병상' },
  avgOccupancy:      { value: 79.4,   change: -0.6,  unit: '%' },
  totalOutpatient:   { value: 1_842_000, change: 4.1, unit: '명/월' },
}
