"""Personal workspace: standard-library HTTP server and persistent SQLite storage."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4
from datetime import date
from datetime import datetime, timezone
from news import get_news
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('WORKSPACE_DATA_DIR', ROOT / '.data')) / 'workspace.sqlite3'



def connect():
    DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.execute('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL)')
    return conn


def validate(kind, data):
    if not isinstance(data, dict):
        raise ValueError('数据格式无效')
    if kind == 'profile':
        result = {}
        for field in ('name', 'headline', 'summary', 'industry', 'academic', 'skills', 'volunteering', 'linkedin', 'cv'):
            value = data.get(field, '')
            if not isinstance(value, str) or len(value) > 5000:
                raise ValueError('档案字段格式无效')
            result[field] = value.strip()
        for field in ('linkedin', 'cv'):
            if result[field]:
                link = urlsplit(result[field])
                if link.scheme not in ('http', 'https') or not link.hostname or link.username or link.password:
                    raise ValueError('请填写有效的公开网页链接')
        return result
    title = data.get('title', '')
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 200:
        raise ValueError('标题不能为空，且不能超过 200 字')
    result = {'title': title.strip()}
    for field in ('notes', 'category', 'due'):
        value = data.get(field, '')
        if not isinstance(value, str) or len(value) > 5000:
            raise ValueError('字段格式无效')
        result[field] = value
    if result['due']:
        date.fromisoformat(result['due'])
    if kind == 'tasks':
        result['priority'] = data.get('priority', 'medium')
        result['status'] = data.get('status', 'todo')
        if result['priority'] not in ('high', 'medium', 'low') or result['status'] not in ('todo', 'doing', 'done'):
            raise ValueError('任务状态或优先级无效')
        goal = data.get('goal', '')
        if not isinstance(goal, str):
            raise ValueError('目标格式无效')
        result['goal'] = goal
    elif kind == 'goals':
        start = data.get('start', '')
        if not isinstance(start, str):
            raise ValueError('日期格式无效')
        if start:
            date.fromisoformat(start)
        if start and result['due'] and start > result['due']:
            raise ValueError('结束日期不能早于开始日期')
        result['start'] = start
        progress = data.get('progress', 0)
        if type(progress) is not int or not 0 <= progress <= 100:
            raise ValueError('进度需要在 0–100 之间')
        result['progress'] = progress
    elif kind == 'opportunities':
        result['stage'] = data.get('stage', 'interested')
        if result['stage'] not in ('interested', 'applied', 'interview', 'offer', 'closed'):
            raise ValueError('机会阶段无效')
    elif kind in ('thoughts', 'inspirations'):
        result['created'] = datetime.now(timezone.utc).isoformat()
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'static'), **kwargs)

    def respond(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/api/news':
            return self.respond(200, get_news(DB.parent))
        if self.path == '/api/state':
            with connect() as conn:
                rows = conn.execute('SELECT id, kind, data FROM items ORDER BY rowid DESC').fetchall()
            state = {'tasks': [], 'goals': [], 'opportunities': [], 'thoughts': [], 'inspirations': [], 'profile': {}}
            for item_id, kind, raw in rows:
                if kind == 'profile':
                    state['profile'] = json.loads(raw)
                else:
                    state[kind].append({**json.loads(raw), 'id': item_id})
            return self.respond(200, state)
        if self.path.startswith('/api/'):
            return self.respond(404, {'error': '未找到接口'})
        return super().do_GET()

    def mutate(self, method):
        # Mutations accept only same-origin JSON requests; this service has no authentication.
        origin = self.headers.get('Origin')
        if origin and origin not in ('http://' + self.headers.get('Host', ''), 'https://' + self.headers.get('Host', '')):
            return self.respond(403, {'error': '不允许跨站修改'})
        parts = self.path.strip('/').split('/')
        is_profile = self.path == '/api/profile' and method == 'PUT'
        if not is_profile and (len(parts) not in (2, 3) or parts[0] != 'api' or parts[1] not in ('tasks', 'goals', 'opportunities', 'thoughts', 'inspirations')):
            return self.respond(404, {'error': '未找到接口'})
        kind = parts[1]
        if not is_profile and ((method == 'POST' and len(parts) != 2) or (method != 'POST' and len(parts) != 3)):
            return self.respond(404, {'error': '未找到接口'})
        item_id = 'personal-profile' if is_profile else str(uuid4()) if method == 'POST' else parts[2]
        try:
            if method != 'DELETE':
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    return self.respond(415, {'error': '需要 JSON 格式'})
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 32768:
                    return self.respond(413, {'error': '请求大小无效'})
                data = validate(kind, json.loads(self.rfile.read(length)))
            with connect() as conn:
                if method != 'POST' and not is_profile and not conn.execute('SELECT 1 FROM items WHERE id=? AND kind=?', (item_id, kind)).fetchone():
                    return self.respond(404, {'error': '记录不存在'})
                if method == 'DELETE':
                    conn.execute('DELETE FROM items WHERE id=? AND kind=?', (item_id, kind))
                    if kind == 'goals':
                        for task_id, raw in conn.execute("SELECT id, data FROM items WHERE kind='tasks'").fetchall():
                            task = json.loads(raw)
                            if task.get('goal') == item_id:
                                task['goal'] = ''
                                conn.execute('UPDATE items SET data=? WHERE id=?', (json.dumps(task), task_id))
                else:
                    if method == 'PUT' and kind in ('thoughts', 'inspirations'):
                        previous = json.loads(conn.execute('SELECT data FROM items WHERE id=? AND kind=?', (item_id, kind)).fetchone()[0])
                        data['created'] = previous['created']
                    if kind == 'tasks' and data['goal'] and not conn.execute("SELECT 1 FROM items WHERE id=? AND kind='goals'", (data['goal'],)).fetchone():
                        raise ValueError('关联目标不存在')
                    conn.execute('INSERT OR REPLACE INTO items (id,kind,data) VALUES (?,?,?)', (item_id, kind, json.dumps(data)))
            self.respond(201 if method == 'POST' else 200, {'id': item_id} if method == 'DELETE' else {**data, 'id': item_id})
        except (ValueError, UnicodeDecodeError):
            self.respond(400, {'error': '请检查标题、日期和字段内容'})

    def do_POST(self):
        self.mutate('POST')

    def do_PUT(self):
        self.mutate('PUT')

    def do_DELETE(self):
        self.mutate('DELETE')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    with connect():
        pass
    print(f'Workspace running at {args.host}:{args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
