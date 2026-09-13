import { useCallback, useEffect, useState } from "react";
import {
  registerServiceWorker,
  requestWaitingWorkerActivation,
} from "./registerServiceWorker";

interface ReloadTarget {
  reload: () => void;
}

export function useAppUpdate(
  navigatorLike: Navigator = globalThis.navigator,
  reloadTarget: ReloadTarget = globalThis.location,
) {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    let active = true;

    void registerServiceWorker(
      () => {
        if (active) setUpdateReady(true);
      },
      navigatorLike,
    ).then((nextRegistration) => {
      if (active) setRegistration(nextRegistration);
    });

    return () => {
      active = false;
    };
  }, [navigatorLike]);

  const refresh = useCallback(() => {
    if (!registration?.waiting) {
      reloadTarget.reload();
      return;
    }

    const serviceWorker = navigatorLike.serviceWorker;
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      reloadTarget.reload();
    };

    serviceWorker.addEventListener("controllerchange", reloadOnce, {
      once: true,
    });
    requestWaitingWorkerActivation(registration);
  }, [navigatorLike, registration, reloadTarget]);

  return { updateReady, refresh };
}
