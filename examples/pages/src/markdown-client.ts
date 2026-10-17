// Markdown uses document navigation, so only its mobile menu needs a small script.
const menu = document.querySelector<HTMLButtonElement>('.mobile-menu');
const navigation = document.getElementById('pages-navigation');
menu?.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  menu.textContent = expanded ? '閉じる' : 'メニュー';
  navigation?.setAttribute('data-expanded', String(expanded));
});
const status = document.getElementById('markdown-script-status');
if (status) status.textContent = 'ページスクリプトも実行されています。';

export {};
