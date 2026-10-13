"""Read public RSS sources with TLS verification, bounded requests and cached results."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import re
import threading
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

SOURCES = [
    ('TechCrunch · AI', 'ai', 'https://techcrunch.com/category/artificial-intelligence/feed/'),
    ('arXiv · AI 研究', 'ai', 'https://rss.arxiv.org/rss/cs.AI'),
    ('BBC · 经济与商业', 'economy', 'https://feeds.bbci.co.uk/news/business/rss.xml'),
]
LOCK = threading.Lock()
LAST_ATTEMPT = 0


def clean(value):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', value or '')).strip()[:600]


def parse_feed(raw, source, category):
    root = ET.fromstring(raw)
    results = []
    for item in root.iter():
        if item.tag.split('}')[-1] not in ('item', 'entry'):
            continue
        fields = {child.tag.split('}')[-1]: child for child in item}
        def text(name):
            node = fields.get(name)
            return node.text if node is not None and node.text else ''
        link = text('link')
        if not link and 'link' in fields:
            link = fields['link'].get('href', '')
        parsed = urlsplit(link)
        if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
            continue
        title = clean(text('title'))
        if not title:
            continue
        raw_date = text('pubDate') or text('date') or text('published') or text('updated')
        try:
            try:
                dt = parsedate_to_datetime(raw_date)
            except (ValueError, TypeError):
                dt = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            published = dt.astimezone(timezone.utc).isoformat()
        except (ValueError, TypeError, OverflowError):
            published = ''
        results.append({'title': title, 'url': link, 'source': source, 'category': category,
                        'published': published, 'summary': clean(text('description') or text('summary'))})
        if len(results) >= 15:
            break
    return results


def fetch_source(source):
    name, category, url = source
    try:
        request = Request(url, headers={'User-Agent': 'LeongWorkspace/1.0 (Personal RSS Reader)'})
        with urlopen(request, timeout=10) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise ValueError('feed too large')
        items = parse_feed(raw, name, category)
        if not items:
            raise ValueError('empty feed')
        return items, None
    except Exception:
        return [], {'source': name, 'message': '暂时无法读取此来源，请检查网络权限或稍后重试。'}


def get_news(data_dir):
    global LAST_ATTEMPT
    cache_path = data_dir / 'news-cache.json'
    with LOCK:
        try:
            cached = json.loads(cache_path.read_text())
        except (FileNotFoundError, ValueError):
            cached = {'items': [], 'updated': None, 'errors': []}
        timestamp = cached.get('fetched_at', 0)
        if time.time() - max(timestamp, LAST_ATTEMPT) < 1800:
            return cached
        LAST_ATTEMPT = time.time()
        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(fetch_source, SOURCES))
        items, errors = [], []
        for source, (fresh, error) in zip(SOURCES, results):
            if error:
                errors.append(error)
                items.extend(i for i in cached.get('items', []) if i['source'] == source[0])
            else:
                items.extend(fresh)
        items = list({i['url']: i for i in items}.values())
        items.sort(key=lambda i: i['published'], reverse=True)
        result = {'items': items, 'errors': errors, 'fetched_at': time.time(),
                  'updated': datetime.now(timezone.utc).isoformat() if any(fresh for fresh, _ in results) else cached.get('updated')}
        data_dir.mkdir(parents=True, exist_ok=True)
        temporary = cache_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, ensure_ascii=False))
        temporary.replace(cache_path)
        return result
