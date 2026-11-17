#!/usr/bin/env python3
"""LabVault SPA 静态服务器 —— 服务 build/ 产物并对前端路由做 SPA 回退。

用法: python3 scripts/serve_spa.py   (PORT 环境变量可覆盖端口,默认 3210)
背景: CRA 5 的 react-scripts dev server 在 Node 24 下会"编译成功"但持续服务
旧内存包(已知兼容性问题),因此日常运行改用 生产构建 + 本服务器。—— zcode
"""
import http.server
import os
import sys
from pathlib import Path

PORT = int(os.environ.get('PORT', 3210))
ROOT = Path(__file__).resolve().parent.parent / 'build'


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path_only = self.path.split('?')[0].split('#')[0]
        target = ROOT / path_only.lstrip('/')
        # 非静态资源(无扩展名)的路径 → SPA 回退到 index.html
        if path_only != '/' and not target.suffix and not target.is_file():
            self.path = '/index.html'
        return super().send_head()


if __name__ == '__main__':
    if not (ROOT / 'index.html').is_file():
        print('build/index.html 不存在 —— 请先运行 npm run build', file=sys.stderr)
        sys.exit(1)
    print(f'LabVault (production build) serving on http://localhost:{PORT}')
    http.server.ThreadingHTTPServer(('0.0.0.0', PORT), SPAHandler).serve_forever()
