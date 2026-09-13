import { vi } from "vitest";

const subjectPath = "../../../src/pwa/registerServiceWorker";

async function loadSubject() {
  return (await import(subjectPath)) as {
    registerServiceWorker: (
      onUpdateReady: () => void,
      navigatorLike?: Navigator,
    ) => Promise<ServiceWorkerRegistration | null>;
    requestWaitingWorkerActivation: (
      registration: ServiceWorkerRegistration,
    ) => void;
  };
}

describe("Phase18 service worker registration", () => {
  it("does nothing when service workers are unavailable", async () => {
    const { registerServiceWorker } = await loadSubject();

    expect(
      await registerServiceWorker(() => undefined, {} as Navigator),
    ).toBeNull();
  });

  it("registers /sw.js and reports a waiting worker as update-ready", async () => {
    const { registerServiceWorker } = await loadSubject();
    const onUpdateReady = vi.fn();
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const registration = { waiting } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const fakeNavigator = {
      serviceWorker: {
        register,
        controller: {} as ServiceWorker,
      },
    } as unknown as Navigator;

    expect(await registerServiceWorker(onUpdateReady, fakeNavigator)).toBe(
      registration,
    );
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });
});
