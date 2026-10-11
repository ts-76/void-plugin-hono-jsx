import { fileURLToPath } from 'node:url';

export const pagesRuntimePath = fileURLToPath(new URL('../runtime/pages.tsx', import.meta.url));
export const clientRuntimePath = fileURLToPath(new URL('../runtime/client.tsx', import.meta.url));
export const publicRuntimeModules: Record<string, { server: string; client: string }> = {};
