-- ============================================================
-- Supabase SQL Editor 에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL PRIMARY KEY,
  text       TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  priority   TEXT    NOT NULL DEFAULT 'medium',
  date       TEXT    NOT NULL,             -- 'YYYY-MM-DD'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security 활성화
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 공개 접근 허용 (데모용)
-- 실제 서비스에서는 auth.uid() 기반 정책으로 교체하세요
CREATE POLICY "public_all" ON todos
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
