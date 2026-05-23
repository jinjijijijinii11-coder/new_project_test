-- =====================================================================
-- 병원군 비교분석 대시보드 - Supabase 스키마
-- Supabase SQL Editor 에서 실행하세요
-- =====================================================================

-- 1. 병원 기본 정보 테이블
CREATE TABLE IF NOT EXISTS hospitals (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('상급종합','종합병원','병원','의원','요양병원')),
  region           TEXT NOT NULL,   -- 시도
  district         TEXT NOT NULL,   -- 시군구
  beds             INTEGER NOT NULL DEFAULT 0,
  established_year INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 병원별 월간 통계 테이블
CREATE TABLE IF NOT EXISTS hospital_stats (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  outpatient_count    INTEGER DEFAULT 0,   -- 외래 환자 수
  inpatient_count     INTEGER DEFAULT 0,   -- 입원 환자 수
  surgery_count       INTEGER DEFAULT 0,   -- 수술 건수
  revenue             BIGINT  DEFAULT 0,   -- 매출액 (만원)
  avg_stay_days       NUMERIC(6,2) DEFAULT 0,
  bed_occupancy_rate  NUMERIC(5,2) DEFAULT 0,
  medical_staff_count INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hospital_id, year, month)
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_hospitals_type   ON hospitals(type);
CREATE INDEX IF NOT EXISTS idx_hospitals_region ON hospitals(region);
CREATE INDEX IF NOT EXISTS idx_stats_year_month ON hospital_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_stats_hospital   ON hospital_stats(hospital_id);

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE hospitals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_stats ENABLE ROW LEVEL SECURITY;

-- 5. 공개 읽기 정책 (필요에 따라 변경)
CREATE POLICY "Public read hospitals"      ON hospitals      FOR SELECT USING (true);
CREATE POLICY "Public read hospital_stats" ON hospital_stats FOR SELECT USING (true);

-- =====================================================================
-- 샘플 데이터 (선택)
-- =====================================================================
-- INSERT INTO hospitals (name, type, region, district, beds, established_year) VALUES
--   ('서울대학교병원',  '상급종합', '서울', '종로구', 1786, 1978),
--   ('세브란스병원',    '상급종합', '서울', '서대문구', 2442, 1885),
--   ('삼성서울병원',    '상급종합', '서울', '강남구', 1979, 1994),
--   ('서울아산병원',    '상급종합', '서울', '송파구', 2706, 1989),
--   ('국립중앙의료원',  '종합병원', '서울', '중구', 752, 1958);
