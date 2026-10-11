import os
# Requires Python 3 and the documented agent-browser Chrome session.
import json
import subprocess
import time


def browser(*arguments):
    return subprocess.run(['agent-browser', '--session', os.environ.get('VOID_HONO_BROWSER_SESSION', 'void-hono-pages'), *arguments], capture_output=True, text=True, check=True).stdout.strip()


def expect(condition):
    browser('eval', 'if (!(' + condition + ')) throw new Error(' + json.dumps(condition) + '); true')


def idle():
    browser('wait', '#app[data-navigation="idle"]')
    time.sleep(0.1)
    expect('document.querySelector("#form-pending").textContent === "false"')


for port in [int(os.environ.get('VOID_HONO_DEV_PORT', '5174')), int(os.environ.get('VOID_HONO_PREVIEW_PORT', '4174'))]:
    browser('open', f'http://127.0.0.1:{port}/edit')
    browser('wait', '#app[data-hono-pages="mounted"]')
    browser('errors', '--clear')
    browser('eval', 'window.actionDocument=123; true')
    browser('fill', '#name', '')
    browser('click', '#save')
    idle()
    expect('document.querySelector("#name-error").textContent === "Name is required." && document.querySelector("#name").value === "" && document.querySelector("#form-success").textContent === "false"')
    for button in ['save', 'put', 'patch']:
        name = button + ' value'
        browser('fill', '#name', name)
        browser('click', '#' + button)
        idle()
        expect('document.querySelector("#saved-name").textContent === ' + json.dumps(name) + ' && document.querySelector("#name").value === ' + json.dumps(name))
        expect('document.querySelector("#form-success").textContent === "true" && window.actionDocument === 123')
    browser('click', '#delete')
    idle()
    expect('document.querySelector("#saved-name").textContent === "Original"')
    browser('open', f'http://127.0.0.1:{port}/named')
    browser('wait', '#app[data-hono-pages="mounted"]')
    browser('fill', '#name', 'Named save')
    browser('click', '#save')
    idle()
    expect('document.querySelector("#saved-name").textContent === "Named save"')
    browser('click', '#fail')
    idle()
    browser('wait', '[role="alert"]')
    expect('document.querySelector("#name").value === "Named save" && document.querySelector("#form-success").textContent === "false"')
    browser('fill', '#name', 'Recovery')
    browser('click', '#save')
    idle()
    expect('!document.querySelector("[role=alert]") && document.querySelector("#saved-name").textContent === "Recovery"')
    # Two synchronous submissions must produce one request.
    before = int(browser('get', 'text', '#submissions'))
    browser('eval', 'document.querySelector("#slow").click(); document.querySelector("#slow").click(); true')
    time.sleep(1)
    idle()
    expect('Number(document.querySelector("#submissions").textContent) === ' + str(before + 1))
    browser('eval', 'document.querySelector("#slow").click(); setTimeout(()=>document.querySelector("#cancel").click(),40); true')
    time.sleep(1)
    idle()
    expect('document.querySelector("#form-success").textContent === "false"')
    browser('click', '#save')
    idle()
    expect('document.querySelector("#form-success").textContent === "true"')
    browser('click', '#redirect')
    browser('wait', '#route-value')
    browser('wait', '#app[data-navigation="idle"]')
    expect('location.pathname === "/users/saved" && document.querySelector("#route-value").textContent === "saved"')
    assert not browser('errors'), 'Unhandled browser error'
    print(f'Form CRUD, named action, validation/input retention, pending/success, failure recovery, duplicate guard, cancellation and redirect passed: {port}', flush=True)
