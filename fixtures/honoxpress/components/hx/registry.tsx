import type { Child } from 'hono/jsx';
import { css } from 'hono/css';
import { createDocsMarkdownRenderer } from 'honoxpress/markdown';
import { Callout, Cards, Card, Steps, Step, Accordion, AccordionItem } from '../honoxpress/docs-content';
import { TypeTable } from '../honoxpress/type-table';
import { useFrontmatter, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';

const render = createDocsMarkdownRenderer({ components: {
  Callout: { kind: 'static', render: ({ attributes, children }) => <Callout title={String(attributes.title ?? '')}>{children}</Callout> },
  Cards: { kind: 'static', render: ({ children }) => <Cards>{children}</Cards> },
  Card: { kind: 'static', render: ({ attributes, children }) => <Card title={String(attributes.title ?? '')}>{children}</Card> },
  Steps: { kind: 'static', render: ({ children }) => <Steps>{children}</Steps> },
  Step: { kind: 'static', render: ({ attributes, children }) => <Step title={String(attributes.title ?? '')}>{children}</Step> },
  Disclosure: { kind: 'static', render: ({ attributes, children }) => <Accordion><AccordionItem title={String(attributes.title ?? '')}>{children}</AccordionItem></Accordion> },
  Properties: { kind: 'static', render: () => {
    const locale = useFrontmatter<{ locale: string }>().locale;
    const props = useMarkdownProps<{ message?: string }>();
    return <section id="hx-properties" class={css`--hx-response-language:${locale};`}><p id="hx-loader">{props.message}</p><TypeTable caption={locale === 'ja' ? 'プロパティ' : 'Properties'} properties={[{ name: 'staticOnlyProperty117', type: 'string | undefined', description: locale === 'ja' ? 'TSXで定義した配列' : 'An array defined in TSX', required: true }]} /></section>;
  } },
} });
export function component(name: string) {
  return function StaticComponent({ children, ...attributes }: Record<string, string | boolean> & { children?: Child }) {
    return render(name, attributes, children);
  };
}
