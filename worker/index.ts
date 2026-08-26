import { createVerifyAccessToken } from "./auth/verifyAccessToken";
import type { Env } from "./env";
import { createRouter } from "./router";

export default {
  fetch(request, env) {
    const router = createRouter({
      verifyAccessToken: (token) => createVerifyAccessToken(env)(token),
    });
    return router(request);
  },
} satisfies ExportedHandler<Env>;
