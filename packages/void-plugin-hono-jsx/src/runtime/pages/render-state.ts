import type { PageObject } from 'void/pages-protocol';

export type RenderFrame = {
  page: PageObject;
  sourceProps: Record<string, unknown>;
  component: unknown;
  layouts: unknown[];
  revision: number;
  commit: number;
};

/** Own render generations and their waiters independently of Hono's component tree. */
export function createRenderState() {
  let revision = 0;
  let commit = 0;
  let committedFrame: RenderFrame | undefined;
  let renderedProps: Record<string, unknown> | undefined;
  const pending = new Map<number, { resolve(): void; reject(error: unknown): void }>();
  const failed = new Set<number>();

  function frame(page: PageObject, component: unknown, layouts: unknown[]): RenderFrame {
    renderedProps = page.props;
    return {
      page: { ...page, props: { ...page.props } },
      sourceProps: page.props,
      component,
      layouts,
      revision,
      commit,
    };
  }
  function settle(through: number, error?: { value: unknown }) {
    for (const [id, waiter] of pending)
      if (id <= through) {
        pending.delete(id);
        if (error) waiter.reject(error.value);
        else waiter.resolve();
      }
  }
  return {
    initial: frame,
    request(page: PageObject, component: unknown, layouts: unknown[], preserveState: boolean) {
      if (!preserveState) revision++;
      const id = ++commit;
      const committed = new Promise<void>((resolve, reject) =>
        pending.set(id, { resolve, reject }),
      );
      return { frame: frame(page, component, layouts), committed };
    },
    acceptsDeferred(props: Record<string, unknown>) {
      return props === renderedProps;
    },
    canCommit(frame: RenderFrame) {
      return !failed.has(frame.commit);
    },
    complete(frame: RenderFrame) {
      if (failed.has(frame.commit)) return;
      committedFrame = frame;
      for (const id of failed) if (id < frame.commit) failed.delete(id);
      settle(frame.commit);
    },
    fail(frame: RenderFrame, error: unknown, recover: (previous: RenderFrame | undefined) => void) {
      if (failed.has(frame.commit)) return;
      failed.add(frame.commit);
      // Failed children never commit. Restore outside the render traversal,
      // and never roll back a newer navigation for an older failure.
      queueMicrotask(() => {
        if (commit === frame.commit) {
          if (committedFrame) renderedProps = committedFrame.sourceProps;
          recover(committedFrame);
        }
        settle(frame.commit, { value: error });
      });
    },
    dispose() {
      settle(Infinity, {
        value: new DOMException('Hono Pages: renderer unmounted.', 'AbortError'),
      });
    },
  };
}
