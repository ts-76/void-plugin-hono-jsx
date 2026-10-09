import { RoutePage } from '../../src/RoutePage';
import type { Props } from './[id].server';

export default function UserPage({ id }: Props) {
  return <RoutePage label="User" value={id} />;
}
