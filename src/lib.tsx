"use client";

import { createStore, useStore } from "./store";
import { usePathname, useRouter } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

// General types -------------------------------------

export type ResponsiveSearchParams = Record<string, string | undefined>;
export type SetResponsiveSearchParams = React.Dispatch<
  React.SetStateAction<ResponsiveSearchParams>
>;

// contexts --------------------------------------------

const ResponsiveSearchParamsCtx = createContext<
  ResponsiveSearchParams | undefined
>(undefined);

const PageSearchParamsCtx = createContext<ResponsiveSearchParams>({});

const SetResponsiveSearchParamsCtx = createContext<
  SetResponsiveSearchParams | undefined
>(undefined);

// stores ----------------------------------------------

const pendingSearchParamsStore = createStore<
  ResponsiveSearchParams | undefined
>(undefined);

// Internals --------------------------------

function stringifySearchParams(params: ResponsiveSearchParams) {
  const keys = Object.keys(params).sort();
  const urlSearchParams = new URLSearchParams(window.location.search);

  for (const key of keys) {
    const val = params[key];
    if (val) {
      urlSearchParams.set(key, val);
    }
  }

  return urlSearchParams.toString();
}

function CacheRSC(props: {
  searchParamsUsed: string[];
  children: React.ReactNode;
  cacheKey: string;
  childrenCache: Map<string, React.ReactNode>;
}) {
  const { childrenCache } = props;
  // eslint-disable-next-line react-compiler/react-compiler

  const pendingSearchParams = useStore(pendingSearchParamsStore);

  // if any of searchParamsUsed is pending
  const isPending = useMemo(() => {
    return (
      pendingSearchParams &&
      props.searchParamsUsed.some((key) => pendingSearchParams[key])
    );
  }, [pendingSearchParams, props.searchParamsUsed]);

  // suspend this component its pending
  if (isPending) {
    throw new Promise<void>((resolve) => {
      const unsubscribe = pendingSearchParamsStore.subscribe(() => {
        const val = pendingSearchParamsStore.getValue();
        if (!val) {
          resolve();
          unsubscribe();
        }
      });
    });
  }

  const cachedChildren = childrenCache.get(props.cacheKey);

  if (cachedChildren) {
    return cachedChildren;
  }

  childrenCache.set(props.cacheKey, props.children);
  return props.children;
}

function useCacheKey(searchParamsUsed: string[]) {
  const responsiveParams = useResponsiveSearchParams();

  const cacheKey = useMemo(() => {
    return searchParamsUsed
      .filter((key) => responsiveParams[key])
      .map((key) => `${key}=${responsiveParams[key]}`)
      .join("&");
  }, [responsiveParams, searchParamsUsed]);

  return cacheKey;
}

// Components -----------------------------------------

export type ResponsiveSearchParamsProviderProps = {
  children: React.ReactNode;
  value: ResponsiveSearchParams;
};

export function ResponsiveSearchParamsProvider(
  props: ResponsiveSearchParamsProviderProps
) {
  const pathname = usePathname();
  const route = useRouter();
  const [isPending, startTransition] = useTransition();

  const pageSearchParams = props.value;
  const visitedSearchParamsRef = useRef(new Set<string>());

  const [searchParamsOverride, setSearchParamsOverride] = useState<
    ResponsiveSearchParams | undefined
  >(undefined);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!isPending) {
      pendingSearchParamsStore.setValue(undefined);
    }
  }, [isPending]);

  const responsiveSearchParams = useMemo(() => {
    return {
      ...pageSearchParams,
      ...searchParamsOverride,
    };
  }, [searchParamsOverride, pageSearchParams]);

  const setResponsiveSearchParams: SetResponsiveSearchParams = useCallback(
    (newSearchParamsDispatch) => {
      const newSearchParams =
        typeof newSearchParamsDispatch === "function"
          ? newSearchParamsDispatch(responsiveSearchParams)
          : newSearchParamsDispatch;

      setSearchParamsOverride(newSearchParams);
      const searchParamsString = stringifySearchParams(newSearchParams);

      // if this search params was already visited
      if (visitedSearchParamsRef.current.has(searchParamsString)) {
        // update window without reloading
        window.history.pushState({}, "", `${pathname}?${searchParamsString}`);
        return;
      }

      // if this search params is new
      visitedSearchParamsRef.current.add(searchParamsString);
      startTransition(() => {
        const newPendingSearchParams: ResponsiveSearchParams = {};
        // check which search param is updated
        for (const key in newSearchParams) {
          if (newSearchParams[key] !== responsiveSearchParams[key]) {
            newPendingSearchParams[key] = newSearchParams[key];
          }
        }

        pendingSearchParamsStore.setValue(newPendingSearchParams);

        route.replace(
          `${pathname}${searchParamsString ? `?${searchParamsString}` : ""}`,
          {
            scroll: false,
          }
        );
      });
    },
    [pathname, route, responsiveSearchParams]
  );

  return (
    <ResponsiveSearchParamsCtx.Provider value={responsiveSearchParams}>
      <PageSearchParamsCtx.Provider value={pageSearchParams}>
        <SetResponsiveSearchParamsCtx.Provider
          value={setResponsiveSearchParams}
        >
          {props.children}
        </SetResponsiveSearchParamsCtx.Provider>
      </PageSearchParamsCtx.Provider>
    </ResponsiveSearchParamsCtx.Provider>
  );
}

export type ResponsiveSuspenseProps = {
  searchParamsUsed: string[];
  children: React.ReactNode;
  fallback: React.ReactNode;
};

export function ResponsiveSuspense(props: ResponsiveSuspenseProps) {
  const cacheKey = useCacheKey(props.searchParamsUsed);
  const [childrenCache] = useState(() => new Map<string, React.ReactNode>());

  return (
    <Suspense fallback={props.fallback}>
      <CacheRSC
        searchParamsUsed={props.searchParamsUsed}
        cacheKey={cacheKey}
        childrenCache={childrenCache}
      >
        {props.children}
      </CacheRSC>
    </Suspense>
  );
}

// Hooks ----------------------------------------------

export function useResponsiveSearchParams() {
  const val = useContext(ResponsiveSearchParamsCtx);
  if (!val) {
    throw new Error(
      "useResponsiveSearchParams must be used within a <ResponsiveSearchParamsProvider>"
    );
  }

  return val;
}

export function useSetResponsiveSearchParams() {
  const val = useContext(SetResponsiveSearchParamsCtx);
  if (!val) {
    throw new Error(
      "useSetResponsiveSearchParams must be used within a <ResponsiveSearchParamsProvider>"
    );
  }
  return val;
}
