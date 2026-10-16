import { createContext, useContext } from 'hono/jsx';
export type MarkdownHeading = { depth: number; slug: string; text: string };
export type MarkdownContextValue = { frontmatter: Record<string, unknown>; headings: MarkdownHeading[]; props: Record<string, unknown> };
export const MarkdownContext = createContext<MarkdownContextValue>({ frontmatter: {}, headings: [], props: {} });
export function useFrontmatter<T = Record<string, unknown>>(): T { return useContext(MarkdownContext).frontmatter as T; }
export function useMarkdownHeadings(): MarkdownHeading[] { return useContext(MarkdownContext).headings; }
export function useMarkdownProps<T = Record<string, unknown>>(): T { return useContext(MarkdownContext).props as T; }
