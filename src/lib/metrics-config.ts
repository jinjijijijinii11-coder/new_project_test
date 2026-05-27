// =====================================================================
// 📋 metrics-config.ts — 실제 DB 컬럼 기반 설정
// hospital_metrics 테이블의 실제 컬럼명과 값에 맞춰져 있습니다
// =====================================================================

// ── 공통 타입 ─────────────────────────────────────────────────────────
export type CategoryKey = 'emergency' | 'surgery' | 'inpatient' | 'discharge' | 'outpatient'
export type GroupTab    = 'tertiary' | 'general' | 'all'

export interface MetricField {
  key:           string    // = metric_name DB 값 (sub_category 있을 땐 'metric_name||sub_category')
  label:         string    // 화면 표시 레이블 (label_path 우선)
  unit?:         string    // 명, 건, %, 일
  isPercent?:    boolean   // true면 소수점 1자리 % 포맷
  displayOrder?: number    // display_order DB 값 (정렬용)
}

export interface CategoryConfig {
  key:        CategoryKey
  label:      string      // 탭 표시 레이블
  dbCategory: string      // major_category DB 값
  metrics:    MetricField[]
}

// ── 카테고리 + 지표 정의 ─────────────────────────────────────────────
// key 값 = hospital_metrics.metric_name 실제 값
export const CATEGORIES: CategoryConfig[] = [
  {
    key:        'emergency',
    label:      '응급실',
    dbCategory: '응급실',
    metrics: [
      { key: '병상수',         label: '응급 병상수',    unit: '개' },
      { key: '진료환자(실)',   label: '진료환자(실)',   unit: '명' },
      { key: '진료환자(연)',   label: '진료환자(연)',   unit: '명' },
      { key: '응급입원환자',   label: '응급입원환자',   unit: '명' },
      { key: '응급환자입원율', label: '응급환자입원율', unit: '%', isPercent: true },
      { key: '응급경유입원율', label: '응급경유입원율', unit: '%', isPercent: true },
    ],
  },
  {
    key:        'surgery',
    label:      '수술실',
    dbCategory: '수술실',
    metrics: [
      { key: '병상수',            label: '수술실 병상수',     unit: '개' },
      { key: '수술건수(수술방)',  label: '수술건수(수술방)', unit: '건' },
      { key: '수술건수(DSC)',     label: '수술건수(DSC)',    unit: '건' },
    ],
  },
  {
    key:        'inpatient',
    label:      '입원',
    dbCategory: '입원',
    metrics: [
      { key: '환자수',    label: '입원환자수(일반)', unit: '명' },
      { key: '입원율',    label: '입원율',          unit: '%', isPercent: true },
      { key: '병상이용율', label: '병상이용율(일반)', unit: '%', isPercent: true },
      { key: '평균재원일', label: '평균재원일(일반)', unit: '일' },
    ],
  },
  {
    key:        'discharge',
    label:      '퇴원',
    dbCategory: '퇴원',
    metrics: [
      { key: '퇴원환자',              label: '퇴원환자(일반)',      unit: '명' },
      { key: '100병상당 퇴원환자수',  label: '100병상당 퇴원환자', unit: '명' },
      { key: '재입원율',              label: '재입원율',            unit: '%', isPercent: true },
    ],
  },
  {
    key:        'outpatient',
    label:      '외래',
    dbCategory: '외래',
    metrics: [
      { key: '외래환자수', label: '외래환자수', unit: '명' },
      { key: '외래신환',   label: '외래신환',  unit: '명' },
      { key: '신환율',     label: '신환율',    unit: '%', isPercent: true },
    ],
  },
]

// ── 병원 그룹 탭 표시 레이블 ─────────────────────────────────────────
export const GROUP_TAB_LABELS: Record<GroupTab, string> = {
  tertiary: '상급종합병원',
  general:  '종합병원',
  all:      '전체',
}

// ── hospital_group DB 값 매핑 ─────────────────────────────────────────
export const HOSPITAL_GROUP_VALUES: Record<Exclude<GroupTab, 'all'>, string> = {
  tertiary: '상급종합병원',
  general:  '종합병원',
}

// ── 우리병원 코드 ─────────────────────────────────────────────────────
export const OUR_HOSPITAL_CODE = '21C'
