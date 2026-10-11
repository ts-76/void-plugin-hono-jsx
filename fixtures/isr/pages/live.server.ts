import { defineHandler } from 'void';
import { props } from '../server/state';
export const revalidate = 0;
export const loader = defineHandler(() => props('/live'));
