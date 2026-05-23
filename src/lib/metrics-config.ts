// =====================================================================
// 📋 metrics-config.ts
// Supabase 테이블 컬럼명 매핑 설정
//
// ⚠️ 실제 컬럼명 확인 방법:
//    localhost:3000/test → 테이블 조회 → 컬럼 목록 확인
//    확인 후 아래 key 값을 실제 컬럼명으로 수정하세요
// =====================================================================

// ── 스키마 설정 (컬럼명 다를 시 여기만 수정) ─────────────────────────
export const SCHEMA = {
  // hospital_master 컬럼명
  MASTER: {
    ID:   'id',              // PK
    NAME: 'name',            // 병원명 (ex: 'hospital_name', '병원명')
    TYPE: 'type',            // 병원 종별 (ex: 'hospital_type', 'category')
  },
  // hospital_metrics 컬럼명
  METRICS: {
    HOSPITAL_ID: 'hospital_id', // FK → hospital_master.id
    YEAR:        'year',
    MONTH:       'month',
  },
} as const

// 병원 종별 타입 값 (hospital_master.type 실제 저장값)
export const HOSPITAL_TYPE_VALUES = {
  TERTIARY: '상급종합',   // 상급종합병원
  GENERAL:  '종합병원',   // 종합병원
} as const

// 우리병원 식별 키워드 (hospital_master.name 에서 포함 여부 검색)
export const OUR_HOSPITAL_KEYWORD = '21C'

// ── 카테고리별 지표 정의 ──────────────────────────────────────────────

export type CategoryKey = 'emergency' | 'surgery' | 'inpatient' | 'discharge' | 'outpatient'
export type GroupTab    = 'tertiary' | 'general' | 'all'

export interface MetricField {
  key:        string    // hospital_metrics 컬럼명
  label:      string    // 화면 표시 레이블
  unit?:      string    // 명, 건, %, 일
  isPercent?: boolean   // true면 소수점 1자리 % 포맷
}

export interface CategoryConfig {
  key:     CategoryKey
  label:   string
  metrics: MetricField[]
}

// ⚠️ key 값이 실제 hospital_metrics 컬럼명과 다르면 수정 필요
export const CATEGORIES: CategoryConfig[] = [
  {
    key:   'emergency',
    label: '응급실',
    metrics: [
      { key: 'er_beds',              label: '응급실 병상수',  unit: '개' },
      { key: 'er_patients',          label: '진료환자(실)',   unit: '명' },
      { key: 'er_annual_patients',   label: '진료환자(연)',   unit: '명' },
      { key: 'er_inpatients',        label: '응급입원환자',   unit: '명' },
      { key: 'er_admission_rate',    label: '응급환자입원율', unit: '%', isPercent: true },
      { key: 'er_transfer_rate',     label: '응급경유입원율', unit: '%', isPercent: true },
    ],
  },
  {
    key:   'surgery',
    label: '수술실',
    metrics: [
      { key: 'surgery_count',        label: '수술건수',       unit: '건' },
      { key: 'surgery_inpatients',   label: '수술입원환자',   unit: '명' },
      { key: 'or_utilization_rate',  label: '수술실 가동률',  unit: '%', isPercent: true },
    ],
  },
  {
    key:   'inpatient',
    label: '입원',
    metrics: [
      { key: 'inpatient_count',      label: '입원환자수',     unit: '명' },
      { key: 'available_beds',       label: '가동병상수',     unit: '개' },
      { key: 'bed_occupancy_rate',   label: '병상가동률',     unit: '%', isPercent: true },
    ],
  },
  {
    key:   'discharge',
    label: '퇴원',
    metrics: [
      { key: 'discharge_count',      label: '퇴원환자수',     unit: '명' },
      { key: 'avg_length_of_stay',   label: '평균재원일수',   unit: '일' },
    ],
  },
  {
    key:   'outpatient',
    label: '외래',
    metrics: [
      { key: 'outpatient_count',     label: '외래환자수',     unit: '명' },
      { key: 'new_patient_count',    label: '신환외래',       unit: '명' },
      { key: 'revisit_rate',         label: '재진율',         unit: '%', isPercent: true },
    ],
  },
]

export const GROUP_TAB_LABELS: Record<GroupTab, string> = {
  tertiary: '상급종합병원',
  general:  '종합병원',
  all:      '전체',
}
