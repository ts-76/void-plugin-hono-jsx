import { defineHandler } from 'void';
import { props } from '../server/state';
export const revalidate = 1;
export const loader = defineHandler(() => props('/'));
