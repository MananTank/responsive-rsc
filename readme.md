# Responsive RSC

Get Responsiveness of Client Components for React Server Components in Next.js - Instant updates with client-side cached RSCs and Suspense fallbacks.


## Conventional way of updating RSCs in Next.js

When using React Server Components (RSCs) in Next.js, The only way to "update" it is by changing it's props. This is usually done by updating the search params of the page using the router from a client component as shown below:

```ts
"use client"

function SomeClientComponent() {
  const router = useRouter();
  const pathname = usePathname();

  function handleUpdate(newSearchParams) {
    router.replace(`/${pathname}?${newSearchParams}`);
  }

  return <> ... </>
}
```

## The Problem

When visiting a page again (same pathname + search params) - It still requires doing a round trip to the server to fetch the updated RSCs - Even if the caching is setup properly for fetching the RSC data, it takes some non-zero time and makes the page feel less responsive

Compare this with a fully client rendered component that uses something like [React Query](https://tanstack.com/query/latest) or [SWR](https://swr.vercel.app/) -  The UI is updated instantly for cached query and doesn't make any requests to the server. This makes the page feel very responsive.

## The Solution

`responsive-rsc` caches the RSCs and updates them instantly when setting search params that were previously visited in the session and avoids making extra requests to the server. The API also allows updating the component that triggers the update (For example: Filter component) to also update instantly - making the page feel very responsive, similar to a fully client rendered component.

## Example Usage


### Installation

```bash
npm install responsive-rsc
```

Consider this scenario: There is a `Filter` component that allows user to select a date range. When user selects a date range, you want to update a server component named `Foo` component. There is a `FooSkeleton` component that renders a skeleton that should be shown while the new data is being fetched.


### With Responsive RSC, you can:
* _Instantly_ update the `Filter` UI when the user selects a new date range and show the `FooSkeleton` while route transition is pending.
* If user selects a previously selected date range - the `Foo` should be updated instantly without making a round trip to the server.

You can achieve this behavior using `responsive-rsc` as shown below:

### Page setup

```tsx
import { ResponsiveSearchParamsProvider, ResponsiveSuspense } from "responsive-rsc";

type PageProps ={
  // In Next.js >=15 - searchParams is a Promise
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page(props: PageProps) {
  // get the search params we are interested in
  const searchParams = await props.searchParams;

  // ensure search param is in expected format
  const from = typeof searchParams.from === 'string' ? searchParams.from : undefined;
  const to = typeof searchParams.to === 'string' ? searchParams.to : undefined;

  // set search params in Provider
  return (
    <ResponsiveSearchParamsProvider value={{ from, to }}>
      <Filter />

     {/* Wrap RSC with ResponsiveSuspense */}
     {/* Specify the search params used by RSC in searchParamsUsed prop */}
     {/* Provide skeleton in fallback prop */}
      <ResponsiveSuspense
        searchParamsUsed={["from", "to"]}
        fallback={<FooSkeleton />}
       >
        <Foo from={from} to={to} />
      </ResponsiveSuspense>
    </ResponsiveSearchParamsProvider>
  );
}

// Example RSC component
async function Foo(props: { from?: string, to?: string }) {
  const data = await fetchFooData(props.from, props.to);
  return <FooUI data={data} />;
}
```

### Filter setup

```tsx
"use client"

import { useResponsiveSearchParams,  useSetResponsiveSearchParams } from "responsive-rsc";

export function Filter() {
  // get searchParams from `useResponsiveSearchParams` to immediately update filter UI when user selects a new date range
  const { from, to } = useResponsiveSearchParams();

  function handleUpdate(newFrom: string, newTo: string) {
    // when this setting new search params -
    // the `Foo` component will immediately suspend and show the `FooSkeleton` if this filter is being set for the first time
    // `Foo` will immediately show data if this filter was set previously and previously shown element will be displayed
    useSetResponsiveSearchParams(v => {
      ...v, // don't overwrite other search params - if any
      from: newFrom,
      to: newTo
    })
  }

  // use `from` and `to` to show the currently selected date range
  // when calling `handleUpdate` with new range - they will be updated instantly - even if new route is still loading
  return <div> ... </div>
}
```

While this Example only shows a single Filter component and Single RSC - It also works with multiple filters and multiple RSCs on the same page - You just need to follow the same pattern shown above

## Important Notes

* If you use `responsive-rsc` for a RSC component - all the RSC component that depend on search params must also use `responsive-rsc` - wrapped in `ResponsiveSuspense` component.
* There should only be a single `ResponsiveSearchParamsProvider` per page
* When using `useSetResponsiveSearchParams` hook - you should avoid overwriting other search params by only updating the search params that you are interested in updating - See above example.


### License

MIT
