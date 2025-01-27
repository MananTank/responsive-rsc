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

export type SearchParams = Record<string, string | string[] | undefined>;
export type SetSearchParams = React.Dispatch<
  React.SetStateAction<SearchParams>
>;

// contexts --------------------------------------------

const ResponsiveSearchParamsCtx = createContext<SearchParams | undefined>(
  undefined
);

const PageSearchParamsCtx = createContext<SearchParams>({});

const SetResponsiveSearchParamsCtx = createContext<SetSearchParams | undefined>(
  undefined
);

const IsRSCPendingCtx = createContext<boolean | undefined>(undefined);

// stores ----------------------------------------------

const pendingSearchParamsStore = createStore<SearchParams | undefined>(
  undefined
);

// Internals --------------------------------

function stringifySearchParams(params: SearchParams) {
  const keys = Object.keys(params).sort();
  const urlSearchParams = new URLSearchParams(window.location.search);

  for (const key of keys) {
    const val = params[key];
    if (val) {
      if (Array.isArray(val)) {
        for (const v of val) {
          urlSearchParams.append(key, v);
        }
      } else {
        urlSearchParams.set(key, val);
      }
    }
  }

  return urlSearchParams.toString();
}

function CacheRSC(props: {
  searchParamsUsed: string[];
  children: React.ReactNode;
  cacheKey: string;
  childrenCache: Map<string, React.ReactNode>;
  suspendOnTransition: boolean;
  isPending: boolean;
}) {
  const { childrenCache, isPending } = props;

  if (isPending && props.suspendOnTransition) {
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

  if (!isPending) {
    childrenCache.set(props.cacheKey, props.children);
  }

  return props.children;
}

function useCacheKey(searchParamsUsed: string[]) {
  const responsiveSearchParams = useResponsiveSearchParams();

  const cacheKey = useMemo(() => {
    return searchParamsUsed
      .filter((key) => responsiveSearchParams[key])
      .map((key) => `${key}=${responsiveSearchParams[key]}`)
      .join("&");
  }, [responsiveSearchParams, searchParamsUsed]);

  return cacheKey;
}

function useIsSearchParamsPending(searchParamNames: string[]) {
  const pendingSearchParams = useStore(pendingSearchParamsStore);
  return useMemo(() => {
    return (
      !!pendingSearchParams &&
      searchParamNames.some((key) => pendingSearchParams[key])
    );
  }, [pendingSearchParams, searchParamNames]);
}

// Components -----------------------------------------

export type ResponsiveSearchParamsProviderProps = {
  children: React.ReactNode;
  value: SearchParams;
};

export function ResponsiveSearchParamsProvider(
  props: ResponsiveSearchParamsProviderProps
) {
  const pathname = usePathname();
  const router = useRouter();
  const [isRoutePending, startRouteTransition] = useTransition();

  const pageSearchParams = props.value;
  const visitedSearchParamsRef = useRef(new Set<string>());

  const [searchParamsOverride, setSearchParamsOverride] = useState<
    SearchParams | undefined
  >(undefined);

  useEffect(() => {
    if (!isRoutePending) {
      pendingSearchParamsStore.setValue(undefined);
    }
  }, [isRoutePending]);

  const responsiveSearchParams = useMemo(() => {
    return {
      ...pageSearchParams,
      ...searchParamsOverride,
    };
  }, [searchParamsOverride, pageSearchParams]);

  const setResponsiveSearchParams: SetSearchParams = useCallback(
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

      // calculate pending search params by comparing new search params with current search params
      const _pendingSearchParams: SearchParams = {};
      for (const key in newSearchParams) {
        if (
          newSearchParams[key]?.toString() !==
          responsiveSearchParams[key]?.toString()
        ) {
          _pendingSearchParams[key] = newSearchParams[key];
        }
      }

      pendingSearchParamsStore.setValue(_pendingSearchParams);

      startRouteTransition(() => {
        router.replace(
          `${pathname}${searchParamsString ? `?${searchParamsString}` : ""}`,
          {
            scroll: false,
          }
        );
      });
    },
    [pathname, router, responsiveSearchParams]
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
  suspendOnTransition?: boolean;
};

export function ResponsiveSuspense(props: ResponsiveSuspenseProps) {
  const cacheKey = useCacheKey(props.searchParamsUsed);
  const [childrenCache] = useState(() => new Map<string, React.ReactNode>());
  const isPending = useIsSearchParamsPending(props.searchParamsUsed);

  return (
    <Suspense fallback={props.fallback}>
      <IsRSCPendingCtx.Provider value={isPending}>
        <CacheRSC
          isPending={isPending}
          suspendOnTransition={
            props.suspendOnTransition === undefined
              ? true
              : props.suspendOnTransition
          }
          searchParamsUsed={props.searchParamsUsed}
          cacheKey={cacheKey}
          childrenCache={childrenCache}
        >
          {props.children}
        </CacheRSC>
      </IsRSCPendingCtx.Provider>
    </Suspense>
  );
}

// Hooks ----------------------------------------------

export function isRSCPending() {
  const val = useContext(IsRSCPendingCtx);
  if (val === undefined) {
    throw new Error("isRSCPending must be used within a <ResponsiveSuspense>");
  }

  return val;
}

export function useResponsiveSearchParams() {
  const val = useContext(ResponsiveSearchParamsCtx);
  if (val === undefined) {
    throw new Error(
      "useResponsiveSearchParams must be used within a <ResponsiveSearchParamsProvider>"
    );
  }

  return val;
}

export function useSetResponsiveSearchParams() {
  const val = useContext(SetResponsiveSearchParamsCtx);
  if (val === undefined) {
    throw new Error(
      "useSetResponsiveSearchParams must be used within a <ResponsiveSearchParamsProvider>"
    );
  }
  return val;
}
