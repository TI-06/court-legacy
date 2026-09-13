import { useCallback, useEffect, useState } from "react";
import {
  registerServiceWorker,
  requestWaitingWorkerActivation,
} from "./registerServiceWorker";

interface ReloadTarget {
  reload: () => void;
}

type Registration = ServiceWorkerRegistration | null;

export function useAppUpdate(
  navigatorLike: Navigator = globalThis.navigator,
  reloadTarget: ReloadTarget = globalThis.location,
) {
  const [registration, setRegistration] = useState<Registration>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    let active = true;

    const handleUpdateReady = () => {
      if (active) setUpdateReady(true);
    };

    const register = async () => {
      const nextRegistration = await registerServiceWorker(
        handleUpdateReady,
        navigatorLike,
      );
      if (active) setRegistration(nextRegistration);
    };

    void register();

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
