# 🏥 병원군 비교분석 대시보드

Next.js 14 + TypeScript + Tailwind CSS + Supabase + Recharts 기반의  
병원군별 의료 통계 비교분석 대시보드입니다.

## 🖥️ 기술 스택

| 기술 | 용도 |
|------|------|
| **Next.js 14** (App Router) | 프레임워크 |
| **TypeScript** | 타입 안전성 |
| **Tailwind CSS** | 스타일링 |
| **Supabase** | 백엔드 / 데이터베이스 |
| **Recharts** | 차트 시각화 |

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 대시보드 메인 페이지
│   └── globals.css         # 전역 스타일
├── components/
│   ├── charts/             # Recharts 차트 컴포넌트
│   │   ├── MonthlyTrendChart.tsx  # 월별 추이 (라인 차트)
│   │   ├── GroupBarChart.tsx      # 병원군 비교 (바 차트)
│   │   ├── RadarCompareChart.tsx  # 다차원 비교 (레이더 차트)
│   │   └── RegionPieChart.tsx     # 지역 분포 (파이 차트)
│   ├── dashboard/
│   │   ├── KpiCard.tsx           # KPI 요약 카드
│   │   ├── FilterBar.tsx         # 필터 컨트롤
│   │   └── GroupSummaryTable.tsx # 상세 테이블
│   ├── layout/
│   │   └── Header.tsx
│   └── ui/
│       ├── Badge.tsx
│       └── LoadingSpinner.tsx
├── hooks/
│   └── useHospitalData.ts  # 데이터 페칭 훅
├── lib/
│   ├── supabase.ts         # Supabase 클라이언트
│   ├── mock-data.ts        # 개발용 목업 데이터
│   └── utils.ts            # 유틸리티 함수
└── types/
    └── hospital.ts         # TypeScript 타입 정의
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일에 Supabase 정보 입력:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase 스키마 생성 (선택)

Supabase 대시보드 → SQL Editor에서 `supabase/schema.sql` 실행

### 4. 개발 서버 실행

```bash
npm run dev
```

→ http://localhost:3000

## 🔌 Supabase 연결하기

현재는 **데모 모드**(목업 데이터)로 동작합니다.  
실제 Supabase 데이터를 사용하려면:

1. `src/hooks/useHospitalData.ts` 파일 열기
2. `USE_REAL_DATA = false` → `true` 변경
3. Supabase 쿼리 구현 (TODO 주석 참고)

## 📊 주요 기능

- **KPI 카드**: 전체 의료기관 수, 병상 수, 병상 가동률, 외래 환자 수
- **월별 추이 차트**: 병원군별 선택 지표 월간 비교
- **병원군 비교 차트**: 바 차트로 지표 비교
- **다차원 레이더 차트**: 여러 지표 동시 비교
- **지역 분포 파이 차트**: 지역별 의료기관 현황
- **상세 테이블**: 병원군별 주요 지표 요약
- **필터 기능**: 연도, 지표, 병원군 필터링

## 🏗️ 빌드

```bash
npm run build
npm start
```
