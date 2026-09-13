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

  it("registers /sw.js and reports a waiting worker as update-ready without activating it", async () => {
    const { registerServiceWorker } = await loadSubject();
    const onUpdateReady = vi.fn();
    const postMessage = vi.fn();
    const waiting = { postMessage } as unknown as ServiceWorker;
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
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("reports an update when a newly installing worker reaches installed state", async () => {
    const { registerServiceWorker } = await loadSubject();
    const onUpdateReady = vi.fn();
    let updateFoundListener: EventListener | null = null;
    let stateChangeListener: EventListener | null = null;
    const installing = {
      state: "installing",
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === "statechange") stateChangeListener = listener;
      }),
    } as unknown as ServiceWorker;
    const registrationState = {
      waiting: null,
      installing: null as ServiceWorker | null,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === "updatefound") updateFoundListener = listener;
      }),
    };
    const registration =
      registrationState as unknown as ServiceWorkerRegistration;
    const fakeNavigator = {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        controller: {} as ServiceWorker,
      },
    } as unknown as Navigator;

    await registerServiceWorker(onUpdateReady, fakeNavigator);
    expect(onUpdateReady).not.toHaveBeenCalled();

    registrationState.installing = installing;
    expect(updateFoundListener).not.toBeNull();
    updateFoundListener?.(new Event("updatefound"));

    Object.defineProperty(installing, "state", {
      configurable: true,
      value: "installed",
    });
    expect(stateChangeListener).not.toBeNull();
    stateChangeListener?.(new Event("statechange"));

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("activates a waiting worker only after an explicit refresh request", async () => {
    const { requestWaitingWorkerActivation } = await loadSubject();
    const postMessage = vi.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;

    requestWaitingWorkerActivation(registration);

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
