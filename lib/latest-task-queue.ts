/**
 * Runs one asynchronous task at a time while retaining only the newest task
 * queued behind the one already in flight.
 *
 * Media events can arrive in bursts (pause, seek, end, unmount). Keeping the
 * newest sample prevents an older request from racing past the final player
 * state without turning every transient event into a network write.
 */
export interface LatestTaskQueue<T> {
  enqueue(value: T): Promise<void>;
  flush(value?: T): Promise<void>;
}

export function createLatestTaskQueue<T>(
  worker: (value: T) => Promise<void>
): LatestTaskQueue<T> {
  let latest: T | undefined;
  let hasLatest = false;
  let running: Promise<void> | null = null;

  const start = (): Promise<void> => {
    if (running) return running;
    if (!hasLatest) return Promise.resolve();

    running = (async () => {
      let firstError: unknown;
      while (hasLatest) {
        const value = latest as T;
        latest = undefined;
        hasLatest = false;
        try {
          await worker(value);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) throw firstError;
    })().finally(() => {
      running = null;
      // A value can be enqueued between the final loop check and this
      // continuation. Start another drain so it cannot be stranded.
      if (hasLatest) void start();
    });

    return running;
  };

  return {
    enqueue(value) {
      latest = value;
      hasLatest = true;
      return start();
    },
    async flush(value) {
      if (arguments.length > 0) {
        latest = value as T;
        hasLatest = true;
      }
      while (running || hasLatest) {
        await start();
      }
    },
  };
}
