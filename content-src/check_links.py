"""Checks every resource link in the study roadmaps (runs in GitHub Actions, which has open internet).
Writes link-report.md. Never fails the build: some sites (LeetCode, ByteByteGo) block bots, so a 403 is
reported as 'blocked' rather than 'broken'."""
import json, os, sys, concurrent.futures as cf, urllib.request, urllib.error
HERE = os.path.dirname(__file__)
urls = {}
for f in ['dsa', 'sd', 'ml']:
    data = json.load(open(os.path.join(HERE, '..', 'src', 'study-data', f + '.json')))
    def walk(n, path):
        for r in n.get('resources', []):
            if r.get('url') and 'youtube.com/results' not in r['url']:
                urls.setdefault(r['url'], f"{f}: {' › '.join(path + [n.get('title', '')])}")
        for c in n.get('children', []):
            walk(c, path + ([n['title']] if n.get('title') and n is not data else []))
    walk(data, [])
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
def check(u):
    for method in ('HEAD', 'GET'):
        try:
            req = urllib.request.Request(u, method=method, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return u, r.status
        except urllib.error.HTTPError as e:
            if method == 'GET': return u, e.code
        except Exception as e:
            if method == 'GET': return u, str(e)[:60]
    return u, 'err'
with cf.ThreadPoolExecutor(16) as ex:
    res = list(ex.map(check, urls))
broken = [(u, s) for u, s in res if not (isinstance(s, int) and s < 400) and s not in (401, 403, 429, 999)]
blocked = [(u, s) for u, s in res if s in (401, 403, 429, 999)]
with open('link-report.md', 'w') as f:
    f.write(f'# Study link check\n\n{len(res)} links · {len(broken)} broken · {len(blocked)} blocked by the site (usually fine in a browser)\n\n## Broken\n')
    for u, s in broken: f.write(f'- `{s}` {u} — {urls[u]}\n')
    f.write('\n## Blocked for bots\n')
    for u, s in blocked: f.write(f'- `{s}` {u}\n')
print(open('link-report.md').read()[:3000])
