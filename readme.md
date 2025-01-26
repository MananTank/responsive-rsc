# Responsive RSC

Get Responsiveness of Client Components for React Server Components in Next.js - Instant updates with client-side cached RSCs and instant Suspense fallbacks.

## The usual way to update RSCs

When using React Server Components (RSCs) in Next.js - The only way to "update" it is by changing the props by updating the search params of the page using the next.js router from a client component

```ts
"use client"

function SomeClientComponent() {
  const router = useRouter();
  const pathname = usePathname();

  function handleUpdate() {
    router.replace(`/${pathname}?${newSearchParams}`);
  }

  return <div> ... </div>
}
```

## The Problem

The problem with this approach is that when revisiting the same page (pathname + search params) - It still does a round trip to the server to fetch the updated RSCs - Even if the caching is setup properly for fetching the RSC data, it takes some time and makes the page feel less responsive.

Compare this with a fully client rendered component that uses something like [React Query](https://tanstack.com/query/latest) or [SWR](https://swr.vercel.app/) - The UI is updated instantly for cached query and doesn't make any requests to the server - This makes the page feel very responsive.

## The Solution

`responsive-rsc` caches the RSCs and updates them instantly when revisiting the same page (same search params) and avoids making extra requests to the server. The API also allows updating the component that triggers the update (For example: Filter component) to also update instantly - making the page feel very responsive, similar to a fully client rendered component.

## Example Usage

Assume that you have a server component named `Foo` - it fetches some data from the server and renders `FooUI`. You also want to show a skeleton when the data is being fetched using `FooSkeleton`. There is a `Filter` component that allows user to select a date range. When user updates the range, you want to update the `Foo` component in a way that feels very responsive.

### The goal is to
* _Instantly_ update the `Filter` UI when the user selects a new date range and show the `FooSkeleton` while the new data is being fetched.
* If user selects a previously selected date range - the `Foo` should be updated instantly without making a round trip to the server.

You can achieve this using `responsive-rsc` like this:


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
  const from = typeof searchParams.from === 'string' ? searchParams.from : undefined;
  const to = typeof searchParams.to === 'string' ? searchParams.to : undefined;

  // set those search params in the Provider
  return (
    <ResponsiveSearchParamsProvider value={{ from, to }}>
      <Filter />

     {/* Wrap RSC with ResponsiveSuspense */}
     {/* Specify the search params dependency in searchParamsUsed prop */}
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

* If you want to make an RSC "responsive" and it uses certain search params - You need to make sure that all the RSCs that depend on those search params are also following the "responsive" pattern - they should be wrapped in `ResponsiveSuspense` as well.
* The component that updates a search param (example: Filter component) and the "responsive" RSCs that depend on that search param should all be wrapped in `ResponsiveSearchParamsProvider` - as a general rule of thumb, you should just have a single `ResponsiveSearchParamsProvider` at the top level of the page and set all the search params used by the RSCs in that provider.
* When using `useSetResponsiveSearchParams` hook - you should avoid overwriting other search params by only updating the search params that you are interested in updating - See above example.


### License

MIT
