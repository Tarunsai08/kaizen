"""Build the DSA subject from Striver's A2Z sheet.

Source data: geckguy/striver-a2z-sheet (MIT) site/data.json — parsed from takeuforward's own sheet
payload with LeetCode / GfG links verified. We keep only titles, links and difficulty (no editorial text).
Structure: Step (topic) -> Sheet topic (subtopic) -> Problem (lesson with resources).
"""
import json, re, os

HERE = os.path.dirname(__file__)
src = json.load(open(os.path.join(HERE, 'a2z_geckguy.json')))

STEP_INFO = {
    1: ("Learn the basics", "Syntax, patterns, basic maths, first arrays/hashing/strings and recursion. Build fluency before patterns."),
    2: ("Sorting techniques", "Selection, bubble, insertion, merge and quick sort — know how each works, its complexity and stability."),
    3: ("Arrays", "From easy to hard array problems: two pointers, prefix sums, Kadane, majority element, merging intervals."),
    4: ("Hashing", "Frequency counting and hash maps to turn O(n²) scans into O(n) lookups."),
    5: ("Binary Search", "1D arrays, binary search on answers, and 2D matrices. Master the invariant, not the template."),
    6: ("Recursion", "Subsequences, backtracking and generating combinations — the base for trees, graphs and DP."),
    7: ("Linked List", "Singly and doubly linked lists: fast/slow pointers, reversal, cycle detection, merge problems."),
    8: ("Bit Manipulation", "Bit tricks: set/clear/toggle bits, XOR properties, counting bits, subsets with masks."),
    9: ("Greedy Algorithms", "Locally optimal choices: scheduling, intervals and when greedy is (not) correct."),
    10: ("Sliding Window & Two Pointers", "Fixed and variable windows for longest/shortest subarray and counting problems."),
    11: ("Stacks & Queues", "Implementation, monotonic stacks (next greater/smaller), and classic stack FAQs like LRU/LFU."),
    12: ("Binary Trees", "Traversals, views, diameter/height, LCA, construction and Morris traversal."),
    13: ("Binary Search Trees", "BST properties, search/insert/delete, validation, successor/predecessor, kth element."),
    14: ("Heaps", "Priority queues: heap implementation, k-th element, merging sorted lists, median of stream."),
    15: ("Graphs", "BFS/DFS, cycles, topological sort, shortest paths (Dijkstra, Bellman-Ford, Floyd), MST, DSU, SCC."),
    16: ("Dynamic Programming", "1D/2D DP, grids, subsequences, strings, stocks, LIS and partition (MCM) DP."),
    17: ("Tries", "Prefix trees for word search, prefix counts and max XOR problems."),
    18: ("Strings (advanced)", "Pattern matching: Z-function, KMP, Rabin-Karp and string hashing."),
    19: ("Maths", "Primes and the Sieve of Eratosthenes, prime factorisation."),
}

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:48]

PLAT = {'leetcode': 'LeetCode', 'gfg': 'GeeksforGeeks', 'takeuforward': 'takeUforward'}

steps = {}
for p in src['problems']:
    st = steps.setdefault(p['step'], {'topics': {}, 'order': []})
    if p['topic'] not in st['topics']:
        st['topics'][p['topic']] = []
        st['order'].append(p['topic'])
    st['topics'][p['topic']].append(p)

children = []
for n in sorted(steps):
    title, summary = STEP_INFO[n]
    st = steps[n]
    step_id = f'dsa.s{n}'
    subs = []
    for tname in st['order']:
        probs = sorted(st['topics'][tname], key=lambda x: x['order'])
        lessons = []
        for p in probs:
            res = [{'title': f"Solve on {PLAT[p['platform']]}", 'url': p['url'], 'kind': 'practice', 'medium': 'problem'}]
            for a in p.get('altUrls') or []:
                res.append({'title': f"Also on {PLAT.get(a['platform'], a['platform'])}", 'url': a['url'], 'kind': 'practice', 'medium': 'problem'})
            if p.get('video'):
                res.append({'title': "Striver's video explanation", 'url': p['video'], 'kind': 'learn', 'medium': 'video'})
            if p.get('article'):
                res.append({'title': 'takeUforward article (intuition + code)', 'url': p['article'], 'kind': 'learn', 'medium': 'article'})
            lessons.append({
                'id': 'dsa.' + p['id'],
                'title': p['title'],
                'difficulty': p['difficulty'] or {'basic': 'Basic', 'core': 'Core', 'pro': 'Pro'}[p['tier']],
                'summary': ' · '.join(x for x in [f"{p['duration']} video" if p.get('video') and p.get('duration') else '', 'LeetCode Premium' if p.get('premium') else ''] if x),
                'resources': res,
                'recall': f"How do you solve “{p['title']}”? Say the approach, why it works, and its time/space complexity.",
            })
        subs.append({'id': f'{step_id}.{slug(tname)}', 'title': tname, 'children': lessons})
    if len(subs) == 1:  # a step with a single sheet topic: show its problems directly
        subs = subs[0]['children']
    children.append({
        'id': step_id,
        'title': f"Step {n}: {title}",
        'summary': summary,
        'resources': [
            {'title': "Striver's A2Z sheet (official)", 'url': src['meta']['source'], 'kind': 'learn', 'medium': 'course'},
            {'title': f"take U forward videos: {title}", 'url': 'https://www.youtube.com/results?search_query=' + ('take+U+forward+striver+' + title).replace(' ', '+'), 'kind': 'learn', 'medium': 'video'},
        ],
        'children': subs,
    })

subject = {
    'id': 'dsa', 'title': 'DSA', 'long': "Data Structures & Algorithms — Striver's A2Z",
    'color': '#fb923c', 'icon': 'i:Code', 'version': 1,
    'description': f"All {len(src['problems'])} problems of Striver's A2Z DSA sheet in its own order: {len(children)} steps → topics → problems. Practice link, Striver's video and article for each.",
    'levels': ['Step', 'Topic', 'Problem'],
    'credits': 'Problem list & verified links: Striver A2Z sheet (takeuforward.org) via github.com/geckguy/striver-a2z-sheet (MIT).',
    'children': children,
}
out = os.path.join(HERE, '..', 'src', 'study-data', 'dsa.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(subject, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
n = 0
def cnt(x):
    global n
    for c in x.get('children', []):
        if c.get('children'): cnt(c)
        else: n += 1
cnt(subject)
print('dsa steps', len(children), 'problems', n, 'bytes', os.path.getsize(out))
