import { z } from "zod";
import {
  InvalidAccountCredentialsError,
  type AccountAuthService,
} from "../auth/AccountAuthService";
import { json, jsonError } from "../http/json";

const loginSchema = z.object({
  loginId: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().min(4).max(24).regex(/^[a-z0-9._-]+$/)),
  password: z.string().min(1).max(128),
});

export function createAccountLoginHandler(auth: AccountAuthService) {
  return async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(
        401,
        "invalid_credentials",
        "ログインIDまたはパスワードが正しくありません",
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        401,
        "invalid_credentials",
        "ログインIDまたはパスワードが正しくありません",
      );
    }

    try {
      const session = await auth.login(parsed.data.loginId, parsed.data.password);
      return json({
        session: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        },
      });
    } catch (error) {
      if (error instanceof InvalidAccountCredentialsError) {
        return jsonError(
          401,
          "invalid_credentials",
          "ログインIDまたはパスワードが正しくありません",
        );
      }
      throw error;
    }
  };
}
