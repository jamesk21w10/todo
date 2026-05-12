-- ============================================================
-- Supabase SQL Editor 에서 실행하세요
-- ※ 이미 todos 테이블이 있다면 아래 ALTER 부분만 실행하세요
-- ============================================================

-- 1) 테이블 생성 (신규)
CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL PRIMARY KEY,
  text       TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  priority   TEXT    NOT NULL DEFAULT 'medium',
  date       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2) 기존 테이블에 user_id 추가 (이미 있으면 에러 무시)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3) RLS 활성화
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 4) 기존 공개 정책 제거 후 사용자별 정책 적용
DROP POLICY IF EXISTS "public_all"  ON todos;
DROP POLICY IF EXISTS "own_todos"   ON todos;

CREATE POLICY "own_todos" ON todos
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Supabase 대시보드 추가 설정
--  Authentication > Providers > Email
--   - "Confirm email" : 개발 중 OFF 권장 (즉시 로그인 가능)
--   - 운영 환경에서는 ON 권장
-- ============================================================
