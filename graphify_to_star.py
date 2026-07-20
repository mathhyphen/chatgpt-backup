"""
graphify_to_star.py — 把 graphify 的 graph.json 转成 graph.html/graph.js 吃的星图格式。

为什么需要这个
-------------
graphify 输出的是 networkx `node_link_data` 格式：
    { "nodes": [{"id","label","type","community","community_name","source_file",...}],
      "links": [{"source","target","type","confidence","confidence_score"}],
      "hyperedges": [...], ... }

而 site/graph.html 的星云星图 (graph.js) 期望：
    { "graph": {"groupLabels":{...}, "stats":{...}},
      "nodes":  [{"id","name","label","type","group","community","tags","summary"}],
      "links":  [{"source","target","type","value"}] }

本脚本做字段映射 + 稀疏社区合并 + 统计计算，保留 graphify 的语义边/自动社区检测，
同时让你继续用自己那套星云视觉。

字段映射
--------
  node.id              -> id
  node.label           -> name + label
  node.type == 'file'  -> 'document'   (graphify 把每个 markdown 当 file；星图里是知识单元)
  node.type 其他       -> 原样保留 (concept/function/...；graph.js 当概念节点)
  node.community       -> group + community   (graph.js 优先读 community)
  node.community_name  -> groupLabels[str(community)]
  node.summary/description -> summary (graphify 通常没有，留空)
  node.tags            -> tags (graphify 通常没有，留空数组)

  link.source/target   -> source/target
  link.type            -> type
  link.confidence      -> value  (EXTRACTED=2, INFERRED=1, AMBIGUOUS=0.5；
                         没有则用 confidence_score*2，再没有默认 1)

稀疏社区合并
------------
graphify 对 40 个 unit 常产出 80+ 微社区（很多只有 1 个节点），全塞进分组面板会爆。
本脚本把成员数 < MIN_MEMBERS (默认 2) 的社区合并进 group 999（"其他"），保留有意义
的社区单独成组。颜色仍由 graph.js 的 golden-angle HSL 按 group id 生成，不受影响。

用法
----
    python graphify_to_star.py
        # 默认: 读 D:/project/papers/graphify-out/graph.json
        #      写 D:/apps/chatgpt-backup/site/graph.json

    python graphify_to_star.py --in PATH --out PATH --min-members 3

前置条件：先在 units 目录跑一次 graphify 生成 graphify-out/graph.json：
    graphify D:/ChatGPT备份/wiki/units --obsidian   # 或加 --update 增量
    python graphify_to_star.py                       # 再跑本脚本

hyperedges 暂不转换 (graph.js 不渲染超边)；如需要可后续改成团扩展。
"""

from __future__ import annotations
import argparse
import json
import sys
from collections import defaultdict, Counter
from pathlib import Path

DEFAULT_IN = Path(r'D:/project/papers/graphify-out/graph.json')
DEFAULT_OUT = Path(r'D:/apps/chatgpt-backup/site/graph.json')

CONFIDENCE_VALUE = {'EXTRACTED': 2.0, 'INFERRED': 1.0, 'AMBIGUOUS': 0.5}
MERGED_GROUP = 999
MERGED_LABEL = '其他'


def convert(in_path: Path, out_path: Path, min_members: int) -> dict:
    raw = json.loads(in_path.read_text(encoding='utf-8'))

    g_nodes = raw.get('nodes', [])
    # graphify 用 "links" 键 (node_link_data)；个别旧版可能用 "edges"
    g_links = raw.get('links') or raw.get('edges') or []

    # 1. 统计每个 community 的成员数，决定哪些合并
    comm_members = defaultdict(list)
    for n in g_nodes:
        cid = n.get('community')
        if cid is None:
            cid = n.get('group', 0)
        comm_members[cid].append(n['id'])
    merged_communities = {cid for cid, ids in comm_members.items()
                          if len(ids) < min_members}

    # 2. 收集每个(保留)社区的标签
    group_labels = {}
    for n in g_nodes:
        cid = n.get('community', n.get('group', 0))
        if cid in merged_communities:
            continue
        name = n.get('community_name') or n.get('label')
        if cid not in group_labels and name and not name.startswith('Community '):
            group_labels[cid] = str(name)[:24]
    group_labels[MERGED_GROUP] = MERGED_LABEL

    # 3. 转换节点
    out_nodes = []
    for n in g_nodes:
        cid = n.get('community')
        if cid is None:
            cid = n.get('group', 0)
        group = MERGED_GROUP if cid in merged_communities else cid

        gtype = n.get('type', 'concept')
        star_type = 'document' if gtype == 'file' else gtype

        label = n.get('label') or n.get('name') or str(n['id']).replace('_', ' ')
        summary = n.get('summary') or n.get('description') or ''
        tags = n.get('tags') or []

        out_nodes.append({
            'id': n['id'],
            'name': label,
            'label': label,
            'type': star_type,
            'group': group,
            'community': group,
            'val': 6,  # graph.js 不读 val（用 degree 算尺寸），留个默认值兼容旧逻辑
            'tags': tags,
            'summary': summary,
        })

    # 4. 转换边（过滤掉端点不存在的，防 dangling）
    node_ids = {n['id'] for n in out_nodes}
    out_links = []
    seen = set()
    for l in g_links:
        s, t = l.get('source'), l.get('target')
        if s not in node_ids or t not in node_ids or s == t:
            continue
        key = (s, t, l.get('type', ''))
        if key in seen:
            continue
        seen.add(key)
        conf = l.get('confidence')
        if 'confidence_score' in l:
            value = float(l['confidence_score']) * 2.0
        elif conf in CONFIDENCE_VALUE:
            value = CONFIDENCE_VALUE[conf]
        else:
            value = float(l.get('value') or l.get('weight') or 1.0)
        out_links.append({
            'source': s,
            'target': t,
            'type': l.get('type') or 'related',
            'value': value,
        })

    # 5. 统计 + groupLabels (key 转字符串，graph.js 用 String(g) 查)
    docs = sum(1 for n in out_nodes if n['type'] == 'document')
    concepts = sum(1 for n in out_nodes if n['type'] != 'document')
    groups = sorted({n['group'] for n in out_nodes})
    group_labels_str = {str(g): group_labels.get(g) or f'社区 {g}' for g in groups}

    star = {
        'directed': bool(raw.get('directed', False)),
        'multigraph': False,
        'graph': {
            'name': 'ChatGPT Backup Wiki Knowledge Graph (graphify)',
            'source': 'graphify semantic extraction + Louvain communities',
            'groupLabels': group_labels_str,
            'stats': {
                'documents': docs,
                'concepts': concepts,
                'links': len(out_links),
                'groups': len(groups),
                'units': docs,
            },
        },
        'nodes': out_nodes,
        'links': out_links,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(star, ensure_ascii=False, indent=2), encoding='utf-8')

    merged_n = sum(len(ids) for cid, ids in comm_members.items() if cid in merged_communities)
    return {
        'in': str(in_path),
        'out': str(out_path),
        'nodes': len(out_nodes),
        'links': len(out_links),
        'groups': len(groups),
        'communities_raw': len(comm_members),
        'communities_merged': len(merged_communities),
        'nodes_merged_into_other': merged_n,
        'documents': docs,
    }


def main():
    ap = argparse.ArgumentParser(description='graphify graph.json -> star graph.json')
    ap.add_argument('--in', dest='inp', default=str(DEFAULT_IN))
    ap.add_argument('--out', default=str(DEFAULT_OUT))
    ap.add_argument('--min-members', type=int, default=2,
                    help='社区成员数 < 此值则合并进 "其他" (默认 2)')
    a = ap.parse_args()
    inp, outp = Path(a.inp), Path(a.out)
    if not inp.exists():
        sys.exit(f'输入不存在: {inp}\n先跑 graphify 生成 graphify-out/graph.json')
    r = convert(inp, outp, a.min_members)
    print(f"graphify -> star 转换完成")
    print(f"  输入:   {r['in']}")
    print(f"  输出:   {r['out']}")
    print(f"  节点:   {r['nodes']} (文档 {r['documents']} / 概念 {r['nodes']-r['documents']})")
    print(f"  边:     {r['links']}")
    print(f"  社区:   {r['communities_raw']} 个 -> 保留 {r['groups']} 组"
          f" (合并 {r['communities_merged']} 个微社区 / {r['nodes_merged_into_other']} 节点进「其他」)")


if __name__ == '__main__':
    main()
