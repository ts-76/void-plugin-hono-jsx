import { RoutePage } from '../../src/RoutePage';
import type { Props } from './[...slug].server';

export default function DocsPage({ slug }: Props) {
  return <RoutePage label="Docs" value={slug} />;
}
