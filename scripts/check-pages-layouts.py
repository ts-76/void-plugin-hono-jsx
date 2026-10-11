import os
# Requires Python 3 and the documented agent-browser Chrome session.
import json
import subprocess
import time
import urllib.request


def browser(*arguments):
    result = subprocess.run(['agent-browser', '--session', os.environ.get('VOID_HONO_BROWSER_SESSION', 'void-hono-pages'), *arguments], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def expect(condition):
    browser('eval', 'if (!(' + condition + ')) throw new Error(' + json.dumps(condition) + '); true')


def visit(name):
    browser('click', '#layout-' + name)
    browser('wait', '#app[data-navigation="idle"]')
    time.sleep(0.1)


chains = {'one': ['root', 'nested'], 'two': ['root', 'nested'], 'named': ['root', 'named'], 'exclusive': ['named'], 'bare': []}
for port in [int(os.environ.get('VOID_HONO_DEV_PORT', '5174')), int(os.environ.get('VOID_HONO_PREVIEW_PORT', '4174'))]:
    base = f'http://127.0.0.1:{port}'
    for name, chain in chains.items():
        with urllib.request.urlopen(base + '/layouts/' + name) as response:
            html = response.read().decode()
        positions = [html.index('data-layout="' + layout + '"') for layout in chain]
        assert positions == sorted(positions), 'Wrong SSR layout order'
        assert html.count('data-layout=') == len(chain), 'Unexpected SSR layout'
        if chain:
            assert 'demo' in html and '/layouts/' + name in html, 'Missing SSR shared data'
    with urllib.request.urlopen(base + '/users/alice') as response:
        html = response.read().decode()
    assert '&quot;id&quot;:&quot;alice&quot;' in html, 'Missing SSR route params'
    browser('open', base + '/layouts/one')
    browser('wait', '#app[data-hono-pages="mounted"]')
    browser('errors', '--clear')
    browser('eval', 'window.layoutDocument=123; true')
    browser('click', '#root-increment')
    browser('click', '#nested-increment')
    browser('eval', 'document.querySelector("#route-count").nextElementSibling.click(); true')
    visit('two')
    expect('document.querySelector("#root-count").textContent === "1" && document.querySelector("#nested-count").textContent === "1" && document.querySelector("#route-count").textContent === "0"')
    expect('document.querySelector("[data-shared=root]").textContent === JSON.stringify({tenant:"demo",path:"/layouts/two"})')
    visit('named')
    expect('document.querySelector("#root-count").textContent === "1" && !document.querySelector("#nested-count") && document.querySelector("#named-count").textContent === "0"')
    visit('one')
    expect('document.querySelector("#root-count").textContent === "1" && document.querySelector("#nested-count").textContent === "0" && !document.querySelector("#named-count")')
    visit('exclusive')
    expect('!document.querySelector("#root-count") && !document.querySelector("#nested-count") && document.querySelector("#named-count")')
    visit('bare')
    expect('!document.querySelector("[data-layout]")')
    visit('one')
    expect('document.querySelector("#root-count").textContent === "0" && document.querySelector("#nested-count").textContent === "0" && window.layoutDocument === 123')
    browser('click', '#nav-alice')
    browser('wait', '#app[data-navigation="idle"]')
    expect('document.querySelector("[data-params=root]").textContent === JSON.stringify({id:"alice"})')
    assert not browser('errors'), 'Unhandled browser error'
    print(f'SSR layout order, named/exclusive/disabled layouts, persistent layout state, page reset, unmount/remount, shared data and params passed: {port}', flush=True)
