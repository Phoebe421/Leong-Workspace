import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer
import server
from news import parse_feed


class WorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.original = server.DB
        server.DB = Path(cls.temp.name) / 'test.sqlite3'
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.httpd.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()
        server.DB = cls.original
        cls.temp.cleanup()

    def request(self, path, method='GET', data=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        req = Request(self.base+path, data=json.dumps(data).encode() if data is not None else None, method=method, headers=headers)
        try:
            with urlopen(req) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_goal_task_lifecycle_and_persistence(self):
        status, goal = self.request('/api/goals', 'POST', {'title': 'AI 与经济方向', 'progress': 25})
        self.assertEqual(status, 201)
        status, task = self.request('/api/tasks', 'POST', {'title': '研究计划', 'goal': goal['id'], 'due': '2026-12-01'})
        self.assertEqual(status, 201)
        status, updated = self.request('/api/tasks/'+task['id'], 'PUT', {**task, 'status': 'done'})
        self.assertEqual(updated['status'], 'done')
        with server.connect() as conn:
            stored = json.loads(conn.execute('SELECT data FROM items WHERE id=?', (task['id'],)).fetchone()[0])
        self.assertEqual(stored['status'], 'done')
        self.assertEqual(self.request('/api/goals/'+goal['id'], 'DELETE')[0], 200)
        tasks = self.request('/api/state')[1]['tasks']
        self.assertEqual(next(t for t in tasks if t['id']==task['id'])['goal'], '')
        self.assertEqual(self.request('/api/tasks/'+task['id'], 'DELETE')[0], 200)
        self.assertEqual(self.request('/api/tasks/'+task['id'], 'DELETE')[0], 404)

    def test_opportunity_stages(self):
        status, item = self.request('/api/opportunities', 'POST', {'title': 'AI 行业机会', 'stage': 'applied'})
        self.assertEqual(status, 201)
        self.assertEqual(self.request('/api/opportunities/'+item['id'], 'PUT', {**item,'stage':'interview'})[1]['stage'], 'interview')
        self.request('/api/opportunities/'+item['id'], 'DELETE')

    def test_profile_persistence_and_safe_links(self):
        profile = {'name': '个人工作台', 'skills': 'AI 与经济', 'cv': 'https://example.com/cv'}
        self.assertEqual(self.request('/api/profile', 'PUT', profile)[0], 200)
        saved = self.request('/api/state')[1]['profile']
        self.assertEqual(saved['skills'], 'AI 与经济')
        self.assertEqual(saved['cv'], profile['cv'])
        self.assertEqual(self.request('/api/profile', 'PUT', {**profile, 'cv': 'javascript:alert(1)'})[0], 400)
        self.assertEqual(self.request('/api/state')[1]['profile'], saved)

    def test_thoughts_and_inspirations_stay_separate(self):
        records = {}
        for kind in ('thoughts', 'inspirations'):
            status, item = self.request('/api/'+kind, 'POST', {'title': kind, 'notes': '一个想法', 'category': 'AI'})
            self.assertEqual(status, 201)
            records[kind] = item
        state = self.request('/api/state')[1]
        self.assertEqual([item['title'] for item in state['thoughts']], ['thoughts'])
        self.assertEqual([item['title'] for item in state['inspirations']], ['inspirations'])
        item = records['thoughts']
        status, changed = self.request('/api/thoughts/'+item['id'], 'PUT', {**item, 'notes': '更新想法'})
        self.assertEqual(status, 200)
        self.assertEqual(changed['created'], item['created'])
        for kind, item in records.items():
            self.assertEqual(self.request('/api/'+kind+'/'+item['id'], 'DELETE')[0], 200)

    def test_reject_invalid_data(self):
        for kind, data in [('tasks',{'title':''}), ('tasks',{'title':'x','due':'not-a-date'}), ('tasks',{'title':'x','goal':'missing'}), ('goals',{'title':'x','progress':101}), ('opportunities',{'title':'x','stage':'invalid'}), ('goals',{'title':'x','start':'2026-12-01','due':'2026-11-01'})]:
            with self.subTest(kind=kind, data=data):
                self.assertEqual(self.request('/api/'+kind,'POST',data)[0],400)

    def test_block_cross_origin_mutation(self):
        self.assertEqual(self.request('/api/tasks','POST',{'title':'x'},origin='https://untrusted.example')[0],403)

    def test_home_served_without_database_access(self):
        with urlopen(self.base+'/') as response:
            self.assertIn('Leong'.encode(),response.read())
        with self.assertRaises(HTTPError):
            urlopen(self.base+'/.data/workspace.sqlite3')

    def test_rss_parser_and_untrusted_links(self):
        raw=b'<rss><channel><item><title>AI news</title><link>https://example.com/a</link><pubDate>Tue, 13 Oct 2026 01:00:00 GMT</pubDate><description>&lt;b&gt;Summary&lt;/b&gt;</description></item><item><title>unsafe</title><link>javascript:alert(1)</link></item></channel></rss>'
        items=parse_feed(raw,'Source','ai')
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['summary'],'Summary')
        self.assertEqual(items[0]['published'],'2026-10-13T01:00:00+00:00')


if __name__ == '__main__':
    unittest.main()
