const paths = {
  home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  form: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5',
  layers: 'm12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 12l10 6 10-6',
  head: 'M4 4h16v16H4ZM4 9h16M9 9v11M13 13h4M13 16h4',
  browser: 'M3 4h18v16H3ZM3 9h18M6 6.5h.01M9 6.5h.01M12 6.5h.01',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1a8 8 0 0 1 13.2 3M4.7 14.9a8 8 0 0 0 13.2 3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  code: 'm8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18',
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
