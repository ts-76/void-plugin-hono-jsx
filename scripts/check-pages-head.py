import os
# Requires Python 3 and the documented agent-browser Chrome session.
import html
import json
import subprocess
import time
import urllib.parse
import urllib.request


def browser(*arguments):
    return subprocess.run(['agent-browser', '--session', os.environ.get('VOID_HONO_BROWSER_SESSION', 'void-hono-pages'), *arguments], capture_output=True, text=True, check=True).stdout.strip()


def expect(condition):
    browser('eval', 'if (!(' + condition + ')) throw new Error(' + json.dumps(condition) + '); true')


def idle():
    browser('wait', '#app[data-navigation="idle"]')
    time.sleep(0.1)


def page_head(name):
    expect('document.title === ' + json.dumps(name + ' | Hono Pages'))
    expect('document.querySelector("meta[name=description]").content === ' + json.dumps(name))
    expect('document.querySelectorAll("meta[name=description]").length===1 && document.querySelectorAll("meta[charset]").length===1 && document.querySelectorAll("meta[name=viewport]").length===1 && document.querySelectorAll("link[rel=icon]").length===1')
    expect('document.querySelector("meta[name=project-only]").content==="Project value" && document.querySelector("meta[name=middleware-only]").content==="Middleware value"')
    expect('document.documentElement.dataset.level==="page" && document.body.dataset.level==="page" && document.documentElement.lang==="en"')
    expect('document.querySelector("link[rel=canonical]").getAttribute("href") === ' + json.dumps('/head/' + name))
    expect('document.querySelectorAll("#page-data").length===1 && JSON.parse(document.querySelector("#page-data").textContent).name === ' + json.dumps(name))


for port in [int(os.environ.get('VOID_HONO_DEV_PORT', '5174')), int(os.environ.get('VOID_HONO_PREVIEW_PORT', '4174'))]:
    base = f'http://127.0.0.1:{port}'
    for name in ['one', 'two']:
        with urllib.request.urlopen(base + '/head/' + name) as response:
            markup = response.read().decode()
        assert '<title>' + name + ' | Hono Pages</title>' in markup
        assert 'name="description" content="' + name + '"' in markup
        assert 'data-page-' + name + '="' + name + '"' in markup
        assert 'id="page-data"' in markup and 'id="project-script"' in markup
        assert markup.count('name="viewport"') == 1 and markup.count('charset="UTF-8"') == 1
        browser('open', base + '/head/' + name)
        browser('wait', '#app[data-hono-pages="mounted"]')
        page_head(name)
    browser('open', base + '/head/one')
    browser('wait', '#app[data-hono-pages="mounted"]')
    browser('errors', '--clear')
    browser('eval', 'window.headDocument=123; window.originalHeadScript=document.querySelector("#project-script"); true')
    for name in ['two', 'one', 'two']:
        browser('click', '#head-' + name)
        idle()
        page_head(name)
        other = 'one' if name == 'two' else 'two'
        expect('!document.querySelector("meta[name=page-' + other + ']") && !document.documentElement.hasAttribute("data-page-' + other + '") && !document.body.hasAttribute("data-page-' + other + '")')
        expect('window.headDocument===123 && window.headExecutions===1 && window.originalHeadScript===document.querySelector("#project-script")')
    browser('back'); idle(); page_head('one')
    browser('forward'); idle(); page_head('two')
    browser('click', '#head-refresh'); idle(); page_head('two')
    browser('click', '#head-default'); idle()
    expect('document.title==="Middleware default | Hono Pages" && document.querySelector("meta[name=description]").content==="Middleware description"')
    expect('document.documentElement.dataset.level==="middleware" && document.body.dataset.level==="middleware" && !document.querySelector("#page-data") && !document.querySelector("link[rel=canonical]")')
    browser('back'); idle(); page_head('two')
    expect('window.pageHeadExecutions===1 && document.querySelector("#page-script")')
    dynamic = '</title><script>window.headInjected=true</script>&"'
    url = base + '/head/one?' + urllib.parse.urlencode({'title': dynamic})
    with urllib.request.urlopen(url) as response:
        markup = response.read().decode()
    assert '<title>' + html.escape(dynamic, quote=True).replace('&#x27;', "'") + ' | Hono Pages</title>' in markup
    assert '<script>window.headInjected=true</script>' not in markup
    browser('open', url)
    browser('wait', '#app[data-hono-pages="mounted"]')
    expect('document.title === ' + json.dumps(dynamic + ' | Hono Pages'))
    expect('document.querySelector("meta[name=description]").content === ' + json.dumps(dynamic))
    expect('JSON.parse(document.querySelector("#page-data").textContent).name === ' + json.dumps(dynamic))
    expect('window.headInjected===undefined')
    assert not browser('errors'), 'Unhandled browser error'
    print(f'SSR, direct access, head precedence, metadata/attribute cleanup, script preservation, back/forward, refresh and escaped dynamic values passed: {port}', flush=True)
