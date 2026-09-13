type NavigatorWithServiceWorker = Navigator & {
  serviceWorker: ServiceWorkerContainer;
};

function hasServiceWorker(
  navigatorLike: Navigator,
): navigatorLike is NavigatorWithServiceWorker {
  return (
    "serviceWorker" in navigatorLike && navigatorLike.serviceWorker != null
  );
}

export async function registerServiceWorker(
  onUpdateReady: () => void,
  navigatorLike: Navigator = globalThis.navigator,
): Promise<ServiceWorkerRegistration | null> {
  if (!hasServiceWorker(navigatorLike)) return null;

  try {
    const container = navigatorLike.serviceWorker;
    const registration = await container.register("/sw.js", { scope: "/" });
    let notified = false;

    const notifyUpdateReady = () => {
      if (notified) return;
      notified = true;
      onUpdateReady();
    };

    if (registration.waiting) {
      notifyUpdateReady();
    }

    registration.addEventListener?.("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && container.controller != null) {
          notifyUpdateReady();
        }
      });
    });

    return registration;
  } catch {
    return null;
  }
}

export function requestWaitingWorkerActivation(
  registration: ServiceWorkerRegistration,
): void {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}
