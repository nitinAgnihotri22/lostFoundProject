// Global API loading state.
// Wrap any async API call in `trackRequest(...)`; <GlobalLoader /> shows an
// overlay while at least one tracked request is in flight. Nested/parallel
// calls are counted, so the overlay stays up until the last one finishes,
// and it shows the message of the most recently started request.
// Messages are i18n keys under `loading.*` (see src/i18n/dictionaries); the
// loader translates them, and shows any other string as-is.

type Entry = { id: number; message: string };

let entries: Entry[] = [];
let nextId = 1;
let snapshot: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  snapshot = entries.length ? entries[entries.length - 1].message : null;
  listeners.forEach((l) => l());
}

export async function trackRequest<T>(
  work: Promise<T> | (() => Promise<T>),
  message = 'loading.default'
): Promise<T> {
  const id = nextId++;
  entries = [...entries, { id, message }];
  emit();
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    entries = entries.filter((e) => e.id !== id);
    emit();
  }
}

export function subscribeLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current loader message, or null when nothing is loading. */
export const getLoadingMessage = () => snapshot;
export const getServerLoadingMessage = () => null;
