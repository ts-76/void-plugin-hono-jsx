/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom';
import { Counter } from './Counter';
import './style.css';

const root = document.getElementById('counter-root');
if (!root) throw new Error('SSR counter-root is missing');
const initialCount = Number(root.dataset.initialCount);
if (!Number.isFinite(initialCount)) throw new Error('Invalid initial count');
render(<Counter initialCount={initialCount} />, root);
document.getElementById('client-status')!.textContent = 'クライアント起動済み: hono/jsx/dom';
