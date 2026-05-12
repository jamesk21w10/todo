# ToDo List 프로젝트

## 개요

Materialize CSS 기반의 ToDo List 웹앱. GitHub Pages(프론트엔드) + Supabase(백엔드)로 운영.

- **GitHub Pages URL**: `https://jamesk21w10.github.io/todo/`
- **GitHub repo**: `git@github.com:jamesk21w10/todo.git`
- **Supabase project**: `https://snfutvnkwprvdmbbgpqk.supabase.co`

## 파일 구조

```
todo/
├── index.html              # GitHub Pages 진입점 (상대경로 사용)
├── templates/index.html    # Flask 템플릿 버전 (절대경로 /static/...)
├── static/
│   ├── css/style.css       # Materialize 커스텀 스타일
│   └── js/
│       ├── config.js       # Supabase URL·ANON KEY
│       └── app.js          # 전체 클라이언트 로직 (Supabase JS SDK v2)
├── app.py                  # Flask 백엔드 (로컬 SQLite 개발용, 미사용)
├── supabase-schema.sql     # Supabase 테이블·RLS 설정 SQL
└── requirements.txt        # Python 의존성 (flask)
```

## 주요 기능

- 월간 달력 — 날짜 선택, 할 일 있는 날 점(dot) 표시
- 할 일 CRUD — 추가·완료체크·수정·삭제
- 우선순위 — 높음/중간/낮음, 배지 클릭으로 사이클 변경
- 정렬 — 우선순위·등록순·이름순·완료순
- 드래그&드롭 — sort_order 기반 순서 변경 (Supabase에 저장)
- 로그인/회원가입 — Supabase Auth (이메일·비밀번호), 탭 전환 UI

## 인증 구조

- 로그인 전: `#loginSection` 표시, `#todoApp` 숨김
- 로그인 후: `#loginSection` 숨김, `#todoApp` 표시, 네비게이션바에 이메일·로그아웃 버튼 노출
- `sb.auth.onAuthStateChange()`로 상태 감지
- 현재 `user_id`는 insert에 포함하지 않음 (테이블에 컬럼 미생성 상태)

## Supabase 테이블 스키마

```sql
CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL PRIMARY KEY,
  text       TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  priority   TEXT    NOT NULL DEFAULT 'medium',
  date       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE  -- 미적용 상태
);
```

### 사용자별 데이터 분리 적용 시

Supabase SQL 에디터에서 실행:

```sql
ALTER TABLE todos ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_todos" ON todos;
CREATE POLICY "own_todos" ON todos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

그 후 `app.js` `addTodo()`의 insert에 `user_id: currentUser.id` 추가.

## Supabase 대시보드 설정

- `Authentication > Providers > Email > Confirm email`: 개발 중 **OFF** 권장

## 배포 워크플로

```bash
# 1. 변경 후 origin에 push
git add <파일들>
git commit -m "..."
git pull --no-rebase
git push

# 2. GitHub Pages용 todo remote에 subtree push
SPLIT=$(git subtree split --prefix=src/exercise/jamesk21w10/day02/todo 2>/dev/null)
git push todo "${SPLIT}:refs/heads/main"
```

> `git subtree push --force` 는 지원 안 됨. 반드시 split → 직접 push 방식 사용.

## 로컬 Flask 서버 실행 (개발용)

```bash
cd /home/ubuntu/work/kosa-vibecoding-2026-1st/src/exercise/jamesk21w10/day02/todo
python3 app.py
```

## 주요 JS 함수 (app.js)

| 함수 | 역할 |
|---|---|
| `loadAll()` | Supabase에서 선택 날짜 할 일·전체 날짜 목록 로드 |
| `renderCalendar()` | 월간 달력 렌더링 |
| `addTodo()` | 할 일 추가 (Supabase insert) |
| `toggleTodo()` | 완료 상태 토글 |
| `deleteTodo()` | 삭제 |
| `cyclePriority()` | 우선순위 순환 변경 |
| `openEditModal()` / `saveEdit()` | 수정 모달 |
| `reorderTodos()` | 드래그&드롭 순서 저장 |
| `signIn()` / `signUp()` / `signOut()` | Supabase Auth |
| `switchTab()` | 로그인·회원가입 탭 전환 |
