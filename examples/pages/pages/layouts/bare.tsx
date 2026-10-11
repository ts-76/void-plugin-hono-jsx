import { LayoutPage } from '../../src/LayoutPage';
import { AppShell } from '../../src/AppShell';
export const layout = false;
export default function Page() { return <AppShell><LayoutPage label="bare" /></AppShell>; }
