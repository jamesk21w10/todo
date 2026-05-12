from flask import Flask, request, jsonify, render_template
import sqlite3
import os

app = Flask(__name__)
DB = os.path.join(os.path.dirname(__file__), 'todo.db')


# ── DB 헬퍼 ──────────────────────────────────────────────────────────────────

def get_conn():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS todos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                text       TEXT    NOT NULL,
                done       INTEGER NOT NULL DEFAULT 0,
                priority   TEXT    NOT NULL DEFAULT 'medium',
                date       TEXT    NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        ''')
        conn.commit()


# ── 라우트 ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/todos', methods=['GET'])
def list_todos():
    date = request.args.get('date', '')
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT * FROM todos WHERE date = ? ORDER BY sort_order, id',
            (date,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/todos/dates', methods=['GET'])
def list_dates():
    with get_conn() as conn:
        rows = conn.execute('SELECT DISTINCT date FROM todos').fetchall()
    return jsonify([r['date'] for r in rows])


@app.route('/api/todos', methods=['POST'])
def create_todo():
    d = request.get_json()
    with get_conn() as conn:
        max_row = conn.execute(
            'SELECT COALESCE(MAX(sort_order), 0) AS m FROM todos WHERE date = ?',
            (d['date'],)
        ).fetchone()
        order = (max_row['m'] or 0) + 1
        cur = conn.execute(
            'INSERT INTO todos (text, done, priority, date, sort_order) VALUES (?, 0, ?, ?, ?)',
            (d['text'], d.get('priority', 'medium'), d['date'], order)
        )
        conn.commit()
        row = conn.execute('SELECT * FROM todos WHERE id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route('/api/todos/<int:tid>', methods=['PUT'])
def update_todo(tid):
    d = request.get_json()
    allowed = {'text', 'done', 'priority'}
    sets, vals = [], []
    for k in allowed:
        if k in d:
            sets.append(f'{k} = ?')
            vals.append(d[k])
    if not sets:
        return jsonify({'error': 'no fields'}), 400
    vals.append(tid)
    with get_conn() as conn:
        conn.execute(f'UPDATE todos SET {", ".join(sets)} WHERE id = ?', vals)
        conn.commit()
        row = conn.execute('SELECT * FROM todos WHERE id = ?', (tid,)).fetchone()
    return jsonify(dict(row))


@app.route('/api/todos/<int:tid>', methods=['DELETE'])
def delete_todo(tid):
    with get_conn() as conn:
        conn.execute('DELETE FROM todos WHERE id = ?', (tid,))
        conn.commit()
    return '', 204


@app.route('/api/todos/reorder', methods=['PATCH'])
def reorder_todos():
    items = request.get_json()
    with get_conn() as conn:
        for item in items:
            conn.execute(
                'UPDATE todos SET sort_order = ? WHERE id = ?',
                (item['sort_order'], item['id'])
            )
        conn.commit()
    return jsonify({'ok': True})


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
