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
    const installingAddEventListener = vi.fn();
    const installing = {
      state: "installing",
      addEventListener: installingAddEventListener,
    } as unknown as ServiceWorker;
    const registrationAddEventListener = vi.fn();
    const registrationState = {
      waiting: null,
      installing: null as ServiceWorker | null,
      addEventListener: registrationAddEventListener,
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
    const updateFoundListener = registrationAddEventListener.mock.calls.find(
      ([type]) => type === "updatefound",
    )?.[1] as EventListener | undefined;
    expect(updateFoundListener).toBeDefined();
    updateFoundListener?.(new Event("updatefound"));

    Object.defineProperty(installing, "state", {
      configurable: true,
      value: "installed",
    });
    const stateChangeListener = installingAddEventListener.mock.calls.find(
      ([type]) => type === "statechange",
    )?.[1] as EventListener | undefined;
    expect(stateChangeListener).toBeDefined();
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
