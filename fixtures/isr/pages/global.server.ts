import { defineHandler } from 'void';
import { props } from '../server/state';
export const loader = defineHandler(() => props('/global'));
