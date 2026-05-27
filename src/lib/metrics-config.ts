// =====================================================================
// 📋 metrics-config.ts — 실제 DB 컬럼 기반 설정
// =====================================================================

export type CategoryKey = 'beds' | 'emergency' | 'surgery' | 'inpatient' | 'discharge' | 'outpatient'
export type GroupTab    = 'tertiary' | 'general' | 'all'

export interface MetricField {
  key:           string   // 'metric_name' 또는 'metric_name||sub_category'
  label:         string   // label_path 우선 (없으면 metricName / subCategory 조합)
  metricName:    string   // DB metric_name 원본
  subCategory:   string   // DB sub_category (없으면 빈 문자열)
  unit?:         string
  isPercent:     boolean
  displayOrder?: number
}

export interface CategoryConfig {
  key:         CategoryKey
  label:       string
  dbCategory:  string
  metricOrder: string[]    // 표시할 metric_name 순서 (화이트리스트)
  metrics:     MetricField[] // legacy — 현재는 빈 배열
}

// ── sub_category 정렬 우선순위 ─────────────────────────────────────────
export const SUB_CATEGORY_ORDER: Record<string, number> = {
  '일반':     0,
  '아기':     1,
  '환자기준': 2,
  '건수기준': 3,
  '조사망율': 4,
  '순사망율': 5,
  '신생아':   6,
  '48시이내': 7,
}

// ── 카테고리 + 지표 정의 ─────────────────────────────────────────────
export const CATEGORIES: CategoryConfig[] = [
  {
    key:        'beds',
    label:      '병상수',
    dbCategory: '병상수',
    metricOrder: ['병상수'],
    metrics: [],
  },
  {
    key:        'emergency',
    label:      '응급실',
    dbCategory: '응급실',
    metricOrder: ['병상수', '진료환자(실)', '진료환자(연)', '응급입원환자', '응급환자입원율', '응급경유입원율'],
    metrics: [],
  },
  {
    key:        'surgery',
    label:      '수술실',
    dbCategory: '수술실',
    metricOrder: ['병상수', 'Day Surgery Center', '수술건수(수술방)', '수술건수(DSC)'],
    metrics: [],
  },
  {
    key:        'inpatient',
    label:      '입원',
    dbCategory: '입원',
    metricOrder: ['환자수', '재원연인원', '입원율', '병상이용율', '병상회전율'],
    metrics: [],
  },
  {
    key:        'discharge',
    label:      '퇴원',
    dbCategory: '퇴원',
    metricOrder: [
      '퇴원환자', '퇴원연인원', '사망환자수', '전과건수', '협의진료수', '재입원수',
      '100병상당 퇴원환자수', '사망률', '전과율', '협의진단율', '재입원율', '평균재원일수',
    ],
    metrics: [],
  },
  {
    key:        'outpatient',
    label:      '외래',
    dbCategory: '외래',
    metricOrder: ['외래환자수', '외래신환', '과초진', '신환율', '평균방문건수'],
    metrics: [],
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
