import { expect, test } from "@playwright/test";

interface ReleaseManifest {
  display?: string;
  icons?: Array<{
    sizes?: string;
    src?: string;
  }>;
}

test("release shell exposes install metadata and required app icons", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);

  const manifest = (await manifestResponse.json()) as ReleaseManifest;
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons?.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );

  const iconSources = manifest.icons
    ?.map((icon) => icon.src)
    .filter((src): src is string => Boolean(src));
  expect(iconSources?.length).toBeGreaterThanOrEqual(2);

  for (const iconSource of iconSources ?? []) {
    const iconResponse = await request.get(iconSource);
    expect(iconResponse.ok()).toBe(true);
  }
});

test("service worker keeps authoritative API routes outside its cache boundary", async ({
  request,
}) => {
  const serviceWorkerResponse = await request.get("/sw.js");
  expect(serviceWorkerResponse.ok()).toBe(true);

  const serviceWorkerSource = await serviceWorkerResponse.text();
  const apiGuard = 'url.pathname.startsWith("/api/")';
  const apiGuardIndex = serviceWorkerSource.indexOf(apiGuard);
  const cacheOpenIndex = serviceWorkerSource.indexOf("caches.open");

  expect(apiGuardIndex).toBeGreaterThanOrEqual(0);
  expect(cacheOpenIndex).toBeGreaterThan(apiGuardIndex);
  expect(serviceWorkerSource).toContain('url.pathname.startsWith("/assets/")');
  expect(serviceWorkerSource).toContain('url.pathname.startsWith("/icons/")');
});
