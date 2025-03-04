"use client";

import { useSyncExternalStore } from "react";

export type Store<T> = {
  getValue(): T;
  setValue(newValue: T): void;
  subscribe(listener: () => void): () => void;
};

export function createStore<T>(initialValue: T): Store<T> {
  type Listener = () => void;
  const listeners = new Set<Listener>();

  let value = initialValue;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getValue() {
      return value;
    },
    setValue(newValue: T) {
      if (newValue === value) {
        return;
      }
      value = newValue;
      notify();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getValue, store.getValue);
}
