import type {
  RemixEventUnsubscribe,
  RemixLifecycleContext,
} from "@remixapp/sdk";

export type Cleanup = () => void | Promise<void>;

export class SubscriptionScope {
  private readonly cleanups = new Set<() => Promise<void>>();
  private readonly controller = new AbortController();

  readonly lifecycle: RemixLifecycleContext = {
    signal: this.controller.signal,
    setTimeout: (callback, delay) => {
      if (this.controller.signal.aborted) return () => undefined;

      const timer = globalThis.setTimeout(() => {
        cancel();
        if (!this.controller.signal.aborted) callback();
      }, delay);
      const cancel = this.addLifecycleCleanup(() =>
        globalThis.clearTimeout(timer),
      );
      return cancel;
    },
    setInterval: (callback, delay) => {
      if (this.controller.signal.aborted) return () => undefined;

      const timer = globalThis.setInterval(() => {
        if (!this.controller.signal.aborted) callback();
      }, delay);
      return this.addLifecycleCleanup(() => globalThis.clearInterval(timer));
    },
  };

  private addLifecycleCleanup(cleanup: () => void): RemixEventUnsubscribe {
    const unsubscribe = this.add(cleanup);
    const abort = () => unsubscribe();
    this.controller.signal.addEventListener("abort", abort, { once: true });
    return () => {
      this.controller.signal.removeEventListener("abort", abort);
      unsubscribe();
    };
  }

  add(cleanup: Cleanup): RemixEventUnsubscribe {
    let active = true;

    const run = async () => {
      if (!active) {
        return;
      }

      active = false;
      this.cleanups.delete(run);
      await cleanup();
    };

    this.cleanups.add(run);

    return () => {
      void run();
    };
  }

  async clear(): Promise<void> {
    this.abort();
    const cleanups = [...this.cleanups];
    this.cleanups.clear();

    await Promise.all(cleanups.map((cleanup) => cleanup()));
  }

  abort(): void {
    this.controller.abort();
  }
}
