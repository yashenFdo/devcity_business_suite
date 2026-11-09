import type { StoreApi } from 'zustand';
import { registerCollection, type Collection } from '../cloud/sync';

/** Use the requested number if it is set and unused, otherwise generate one. */
export const resolveNumber = (
  requested: string | undefined,
  existing: readonly string[],
  generate: (existing: readonly string[]) => string
): string => {
  const wanted = requested?.trim();
  return wanted && !existing.includes(wanted) ? wanted : generate(existing);
};

export const nowIso = () => new Date().toISOString();

/** Wire a store's list to the cloud sync engine (initial load + live updates from colleagues). */
export const connectCollection = <S, T extends { id: string }>(
  name: Collection,
  store: StoreApi<S>,
  key: keyof S & string
) => {
  const list = () => store.getState()[key] as unknown as T[];
  const setList = (items: T[]) => store.setState({ [key]: items } as unknown as Partial<S>);
  registerCollection(name, {
    replaceAll: (items) => setList(items as T[]),
    applyRemote: (item) => {
      const items = list();
      const exists = items.some((i) => i.id === item.id);
      setList(exists ? items.map((i) => (i.id === item.id ? (item as T) : i)) : [item as T, ...items]);
    },
    removeRemote: (id) => setList(list().filter((i) => i.id !== id)),
  });
};
