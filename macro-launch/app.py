#!/usr/bin/env python3
"""Macro Launch — local hub for MuskCult and other creative tools.

Serves a small web UI on http://127.0.0.1:8765 and can start MuskCult.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CONFIG_PATH = ROOT / "tools.json"
HOST = "127.0.0.1"
PORT = 8765
MUSKCULT_PORT = 5173
MUSKCULT_URL = f"http://{HOST}:{MUSKCULT_PORT}/"


def load_tools() -> list[dict]:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return []


def muskcult_up() -> bool:
    try:
        with urllib.request.urlopen(MUSKCULT_URL, timeout=1.2) as resp:
            return resp.status == 200
    except Exception:
        return False


def ensure_muskcult() -> str:
    if muskcult_up():
        return MUSKCULT_URL

    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm not found — install Node.js to run MuskCult")

    subprocess.Popen(
        [npm, "run", "dev", "--", "--host", HOST, "--port", str(MUSKCULT_PORT)],
        cwd=str(REPO),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    for _ in range(50):
        time.sleep(0.2)
        if muskcult_up():
            break
    return MUSKCULT_URL


def launch_tool(tool_id: str) -> dict:
    tools = {t.get("id"): t for t in load_tools()}
    tool = tools.get(tool_id)
    if not tool:
        raise KeyError(f"Unknown tool: {tool_id}")

    kind = tool.get("kind", "url")

    if tool_id == "muskcult" or kind == "muskcult":
        url = ensure_muskcult()
        return {"ok": True, "opened": url}

    if kind == "url":
        return {"ok": True, "opened": tool["target"]}

    if kind == "command":
        target = tool["target"]
        cwd = tool.get("cwd")
        if cwd:
            cwd_path = Path(cwd).expanduser()
            if not cwd_path.exists():
                raise FileNotFoundError(f"Tool path not found: {cwd_path}")
            cwd = str(cwd_path)
        subprocess.Popen(
            target if isinstance(target, list) else target,
            cwd=cwd,
            shell=isinstance(target, str),
            start_new_session=True,
        )
        return {"ok": True, "opened": "command"}

    raise RuntimeError(f"Unsupported kind: {kind}")


INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Macro Launch</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Sora:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #e6e9ee;
      --ink: #12141a;
      --muted: #6b7385;
      --surface: rgba(255,255,255,.78);
      --line: rgba(18,20,26,.12);
      --accent: #ff3b1f;
      --cyan: #0a7ea4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: Sora, system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 70% 45% at 8% -5%, rgba(255,59,31,.16), transparent 55%),
        radial-gradient(ellipse 55% 40% at 100% 0%, rgba(10,126,164,.18), transparent 50%),
        linear-gradient(165deg, #eef1f5, var(--bg) 45%, #d0d6e0);
    }
    main { max-width: 720px; margin: 0 auto; padding: 2.4rem 1.25rem 3rem; }
    .brand {
      font-family: "Bricolage Grotesque", Georgia, serif;
      font-weight: 800; font-size: clamp(2.4rem, 7vw, 3.6rem);
      letter-spacing: -.04em; line-height: .95; margin: 0;
    }
    .sub { color: var(--muted); margin: .7rem 0 1.6rem; max-width: 36ch; }
    .grid { display: grid; gap: .85rem; }
    .card {
      display: grid; grid-template-columns: 1fr auto; gap: .75rem; align-items: center;
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      padding: 1rem 1.05rem; backdrop-filter: blur(10px);
      box-shadow: 0 14px 40px rgba(18,20,26,.07);
    }
    .card h2 {
      font-family: "Bricolage Grotesque", Georgia, serif;
      font-size: 1.15rem; margin: 0 0 .2rem; letter-spacing: -.02em;
    }
    .card p { margin: 0; color: var(--muted); font-size: .86rem; line-height: 1.4; }
    button {
      border: 0; border-radius: 10px; padding: .7rem 1rem; font: inherit; font-weight: 600;
      background: var(--ink); color: #f5f6f8; cursor: pointer;
    }
    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: .5; cursor: wait; transform: none; }
    .status {
      margin-top: 1.1rem; min-height: 1.2rem; color: var(--cyan); font-size: .84rem;
    }
    .foot { margin-top: 2rem; color: var(--muted); font-size: .75rem; }
  </style>
</head>
<body>
  <main>
    <p class="brand">Macro Launch</p>
    <p class="sub">One click into your creative tools. MuskCult is ready here.</p>
    <div class="grid" id="tools"></div>
    <p class="status" id="status"></p>
    <p class="foot">Edit <code>macro-launch/tools.json</code> to add more apps.</p>
  </main>
  <script>
    const statusEl = document.getElementById('status');
    async function load() {
      const res = await fetch('/api/tools');
      const tools = await res.json();
      const root = document.getElementById('tools');
      root.innerHTML = '';
      for (const t of tools) {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <div>
            <h2>${t.name}</h2>
            <p>${t.blurb || ''}</p>
          </div>
          <button type="button" data-id="${t.id}">Launch</button>
        `;
        root.appendChild(card);
      }
      root.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          statusEl.textContent = `Starting ${btn.dataset.id}…`;
          try {
            const res = await fetch('/api/launch/' + btn.dataset.id, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Launch failed');
            statusEl.textContent = data.opened && data.opened.startsWith('http')
              ? `Opened ${data.opened}`
              : 'Launched.';
            if (data.opened && data.opened.startsWith('http')) {
              window.open(data.opened, '_blank');
            }
          } catch (err) {
            statusEl.textContent = err.message || String(err);
          } finally {
            btn.disabled = false;
          }
        });
      });
    }
    load();
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # quieter
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code: int, payload: dict | list) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, html: str) -> None:
        body = html.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._html(200, INDEX_HTML)
            return
        if path == "/api/tools":
            self._json(200, load_tools())
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "muskcult": muskcult_up()})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path.startswith("/api/launch/"):
            tool_id = path.rsplit("/", 1)[-1]
            try:
                result = launch_tool(tool_id)
                self._json(200, result)
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return
        self._json(404, {"error": "not found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"Macro Launch → {url}", flush=True)
    print("MuskCult is listed in tools.json. Ctrl+C to stop.", flush=True)

    def _open() -> None:
        time.sleep(0.4)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBye.")
        server.shutdown()


if __name__ == "__main__":
    main()
