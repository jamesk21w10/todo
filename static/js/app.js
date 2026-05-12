// ── Supabase 클라이언트 초기화 ─────────────────────────────────────────────
if (
  SUPABASE_URL  === 'https://YOUR_PROJECT_ID.supabase.co' ||
  SUPABASE_ANON_KEY === 'YOUR_ANON_PUBLIC_KEY'
) {
  document.addEventListener('DOMContentLoaded', () => {
    M.toast({ html: '⚠️ static/js/config.js 에서 Supabase 설정을 완료해주세요.', classes: 'red' });
  });
}

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 상수 ──────────────────────────────────────────────────────────────────────
const PRI_ORDER = { high: 0, medium: 1, low: 2 };
const PRI_LABEL = { high: '높음', medium: '중간', low: '낮음' };
const PRI_CYCLE = { high: 'medium', medium: 'low', low: 'high' };

// ── 상태 ──────────────────────────────────────────────────────────────────────
let currentUser    = null;
let todos          = [];
let datesWithTodos = new Set();
let selectedDate   = todayKey();
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth() + 1;
let selectedPri    = 'medium';
let sortBy         = 'priority';
let dragSrcId      = null;
let editingId      = null;
let editPri        = 'medium';
let editModal      = null;

// ── 날짜 유틸 ─────────────────────────────────────────────────────────────────
function toKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function fmtDate(key) {
  const [y, m, d] = key.split('-');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(key).getDay()];
  return `${y}년 ${+m}월 ${+d}일 (${dow})`;
}

// ── Supabase 데이터 로드 ───────────────────────────────────────────────────────
async function loadAll() {
  const [todosRes, datesRes] = await Promise.all([
    sb.from('todos')
      .select('*')
      .eq('date', selectedDate)
      .order('sort_order', { ascending: true })
      .order('id',         { ascending: true }),
    sb.from('todos').select('date'),
  ]);

  if (todosRes.error) { toast('할 일 로드 실패: ' + todosRes.error.message); return; }
  if (datesRes.error) { toast('날짜 로드 실패: ' + datesRes.error.message); return; }

  todos          = todosRes.data  || [];
  datesWithTodos = new Set((datesRes.data || []).map(r => r.date));
  renderCalendar();
  renderTodos();
}

// ── 달력 ──────────────────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('monthLabel').textContent = `${calYear}년 ${calMonth}월`;

  const grid     = document.getElementById('calDays');
  const today    = todayKey();
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const lastDate = new Date(calYear, calMonth, 0).getDate();
  const prevLast = new Date(calYear, calMonth - 1, 0).getDate();

  grid.innerHTML = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    const m = calMonth === 1 ? 12 : calMonth - 1;
    const y = calMonth === 1 ? calYear - 1 : calYear;
    addCell(grid, y, m, prevLast - i, true, today);
  }
  for (let d = 1; d <= lastDate; d++) addCell(grid, calYear, calMonth, d, false, today);
  const remain = (firstDay + lastDate) % 7;
  if (remain) {
    const m = calMonth === 12 ? 1 : calMonth + 1;
    const y = calMonth === 12 ? calYear + 1 : calYear;
    for (let d = 1; d <= 7 - remain; d++) addCell(grid, y, m, d, true, today);
  }
}

function addCell(grid, y, m, d, other, today) {
  const key  = toKey(y, m, d);
  const cell = document.createElement('div');
  const dow  = new Date(key).getDay();

  cell.className = 'cal-day';
  if (other)            cell.classList.add('other-month');
  if (dow === 0)        cell.classList.add('sunday');
  if (dow === 6)        cell.classList.add('saturday');
  if (key === today)    cell.classList.add('today');
  if (key === selectedDate) cell.classList.add('selected');

  const num = document.createElement('span');
  num.textContent = d;
  cell.appendChild(num);

  if (datesWithTodos.has(key)) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    cell.appendChild(dot);
  }

  cell.onclick = () => {
    selectedDate = key;
    calYear = y; calMonth = m;
    loadAll();
  };
  grid.appendChild(cell);
}

function goToday() {
  const t = new Date();
  selectedDate = todayKey();
  calYear  = t.getFullYear();
  calMonth = t.getMonth() + 1;
  loadAll();
}

document.getElementById('prevBtn').onclick = () => {
  if (--calMonth < 1) { calMonth = 12; calYear--; }
  renderCalendar();
};
document.getElementById('nextBtn').onclick = () => {
  if (++calMonth > 12) { calMonth = 1; calYear++; }
  renderCalendar();
};

// ── 우선순위 선택기 ───────────────────────────────────────────────────────────
function applyPriChips(container, active) {
  container.querySelectorAll('.pri-chip').forEach(c => {
    c.classList.remove('sel-high', 'sel-medium', 'sel-low');
    if (c.dataset.p === active) c.classList.add(`sel-${active}`);
  });
}

function setPriority(p) {
  selectedPri = p;
  applyPriChips(document.querySelector('.input-card'), p);
}

function setEditPriority(p) {
  editPri = p;
  applyPriChips(document.getElementById('editModal'), p);
}

// ── 정렬 ──────────────────────────────────────────────────────────────────────
function setSort(s) {
  sortBy = s;
  document.querySelectorAll('.sort-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.s === s)
  );
  renderTodos();
}

function getSorted() {
  const copy = [...todos];
  if (sortBy === 'priority') return copy.sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
  if (sortBy === 'added')    return copy.sort((a, b) => a.sort_order - b.sort_order);
  if (sortBy === 'name')     return copy.sort((a, b) => a.text.localeCompare(b.text, 'ko'));
  if (sortBy === 'done')     return copy.sort((a, b) => Number(a.done) - Number(b.done));
  return copy;
}

// ── 할 일 렌더 ────────────────────────────────────────────────────────────────
function renderTodos() {
  document.getElementById('dateLabel').textContent = fmtDate(selectedDate);

  const sorted   = getSorted();
  const list     = document.getElementById('todoList');
  const emptyMsg = document.getElementById('emptyMsg');
  list.innerHTML = '';

  if (sorted.length === 0) {
    emptyMsg.style.display = 'flex';
  } else {
    emptyMsg.style.display = 'none';
    sorted.forEach(todo => list.appendChild(makeTodoItem(todo)));
  }

  const done = todos.filter(t => t.done).length;
  document.getElementById('totalCount').textContent = `전체 ${todos.length}개`;
  document.getElementById('doneCount').textContent  = `완료 ${done}개`;
}

function makeTodoItem(todo) {
  const li = document.createElement('li');
  li.className = `collection-item todo-item${todo.done ? ' is-done' : ''}`;
  li.dataset.id = todo.id;
  li.draggable  = true;

  li.addEventListener('dragstart', e => {
    dragSrcId = todo.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.drop-before, .drop-after')
      .forEach(el => el.classList.remove('drop-before', 'drop-after'));
  });
  li.addEventListener('dragover', e => {
    e.preventDefault();
    document.querySelectorAll('.drop-before, .drop-after')
      .forEach(el => el.classList.remove('drop-before', 'drop-after'));
    const mid = li.getBoundingClientRect().top + li.offsetHeight / 2;
    li.classList.add(e.clientY < mid ? 'drop-before' : 'drop-after');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
  li.addEventListener('drop', e => {
    e.preventDefault();
    if (dragSrcId === todo.id) return;
    const before = e.clientY < li.getBoundingClientRect().top + li.offsetHeight / 2;
    li.classList.remove('drop-before', 'drop-after');
    reorderTodos(dragSrcId, todo.id, before);
  });

  const handle = document.createElement('span');
  handle.className   = 'drag-handle';
  handle.textContent = '⠿';
  handle.title       = '드래그하여 순서 변경';

  const cb = document.createElement('input');
  cb.type      = 'checkbox';
  cb.className = 'm-check';
  cb.checked   = !!todo.done;
  cb.onchange  = () => toggleTodo(todo.id, cb.checked);

  const badge = document.createElement('span');
  badge.className   = `item-pri pri-${todo.priority}`;
  badge.textContent = PRI_LABEL[todo.priority];
  badge.title       = '클릭하여 우선순위 변경';
  badge.onclick     = () => cyclePriority(todo);

  const text = document.createElement('span');
  text.className   = `todo-text${todo.done ? ' done' : ''}`;
  text.textContent = todo.text;

  const actions = document.createElement('span');
  actions.className = 'item-actions';

  const editBtn = document.createElement('a');
  editBtn.className = 'btn-flat btn-small waves-effect';
  editBtn.innerHTML = '<i class="material-icons small">edit</i>';
  editBtn.title     = '수정';
  editBtn.onclick   = () => openEditModal(todo);

  const delBtn = document.createElement('a');
  delBtn.className = 'btn-flat btn-small waves-effect';
  delBtn.innerHTML = '<i class="material-icons small red-text">delete</i>';
  delBtn.title     = '삭제';
  delBtn.onclick   = () => deleteTodo(todo.id);

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  li.appendChild(handle);
  li.appendChild(cb);
  li.appendChild(badge);
  li.appendChild(text);
  li.appendChild(actions);
  return li;
}

// ── CRUD (Supabase) ───────────────────────────────────────────────────────────
async function addTodo() {
  const input = document.getElementById('todoInput');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }

  const { data: maxRow } = await sb
    .from('todos')
    .select('sort_order')
    .eq('date', selectedDate)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const order = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await sb.from('todos').insert({
    text, done: false, priority: selectedPri, date: selectedDate, sort_order: order,
  });

  if (error) { toast('추가 실패: ' + error.message); return; }

  input.value = '';
  M.updateTextFields();
  input.focus();
  await loadAll();
}

async function toggleTodo(id, done) {
  const { data: updated, error } = await sb
    .from('todos').update({ done }).eq('id', id).select().single();
  if (error) { toast('수정 실패'); return; }
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx] = updated;
  renderTodos();
}

async function deleteTodo(id) {
  const { error } = await sb.from('todos').delete().eq('id', id);
  if (error) { toast('삭제 실패'); return; }
  await loadAll();
}

async function cyclePriority(todo) {
  const next = PRI_CYCLE[todo.priority];
  const { data: updated, error } = await sb
    .from('todos').update({ priority: next }).eq('id', todo.id).select().single();
  if (error) { toast('우선순위 변경 실패'); return; }
  const idx = todos.findIndex(t => t.id === todo.id);
  if (idx !== -1) todos[idx] = updated;
  renderTodos();
}

// ── 수정 모달 ─────────────────────────────────────────────────────────────────
function openEditModal(todo) {
  editingId = todo.id;
  editPri   = todo.priority;
  document.getElementById('editInput').value = todo.text;
  setEditPriority(todo.priority);
  M.updateTextFields();
  editModal.open();
}

async function saveEdit() {
  const text = document.getElementById('editInput').value.trim();
  if (!text) return;
  const { data: updated, error } = await sb
    .from('todos').update({ text, priority: editPri }).eq('id', editingId).select().single();
  if (error) { toast('저장 실패'); return; }
  const idx = todos.findIndex(t => t.id === editingId);
  if (idx !== -1) todos[idx] = updated;
  editModal.close();
  renderTodos();
}

// ── 드래그&드롭 순서 변경 ─────────────────────────────────────────────────────
async function reorderTodos(fromId, toId, before) {
  const sorted  = getSorted();
  const fromIdx = sorted.findIndex(t => t.id === fromId);
  const toIdx   = sorted.findIndex(t => t.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;

  const arr = [...sorted];
  const [item] = arr.splice(fromIdx, 1);
  let insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
  if (!before) insertAt++;
  arr.splice(Math.max(0, Math.min(arr.length, insertAt)), 0, item);

  const payload = arr.map((t, i) => ({ id: t.id, sort_order: i }));

  await Promise.all(
    payload.map(p => sb.from('todos').update({ sort_order: p.sort_order }).eq('id', p.id))
  );

  todos = todos.map(t => {
    const p = payload.find(x => x.id === t.id);
    return p ? { ...t, sort_order: p.sort_order } : t;
  });

  if (sortBy !== 'added') setSort('added');
  else renderTodos();
}

// ── 인증 ──────────────────────────────────────────────────────────────────────
async function signIn() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { toast('이메일과 비밀번호를 입력하세요'); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) toast(authErrMsg(error.message));
}

async function signUp() {
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;
  if (password.length < 6) { toast('비밀번호는 6자 이상이어야 합니다'); return; }
  if (password !== confirm) { toast('비밀번호가 일치하지 않습니다'); return; }
  const { error } = await sb.auth.signUp({ email, password });
  if (error) { toast(authErrMsg(error.message)); return; }
  M.toast({ html: '가입 완료! 로그인하세요.', classes: 'green darken-2' });
  switchTab('login');
}

async function signOut() {
  await sb.auth.signOut();
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').classList.toggle('visible', isLogin);
  document.getElementById('signupForm').classList.toggle('visible', !isLogin);
  document.getElementById('tabLoginBtn').classList.toggle('active', isLogin);
  document.getElementById('tabSignupBtn').classList.toggle('active', !isLogin);
  M.updateTextFields();
}

function authErrMsg(msg) {
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (msg.includes('Email not confirmed'))        return '이메일 인증을 완료해주세요';
  if (msg.includes('User already registered'))    return '이미 등록된 이메일입니다';
  return msg;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function toast(msg) {
  M.toast({ html: msg, classes: 'red darken-2' });
}

// ── 초기화 ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  editModal = M.Modal.init(document.getElementById('editModal'), {});

  document.getElementById('todoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
  document.getElementById('editInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
  });

  setPriority('medium');
  setSort('priority');

  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
      document.getElementById('userEmail').textContent = currentUser.email;
      document.getElementById('userNav').style.display = '';
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('todoApp').style.display = 'block';
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') loadAll();
    } else {
      currentUser = null;
      document.getElementById('userNav').style.display = 'none';
      document.getElementById('loginSection').style.display = 'flex';
      document.getElementById('todoApp').style.display = 'none';
    }
  });
});
