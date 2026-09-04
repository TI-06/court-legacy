import { z } from "zod";
import {
  AccountConflictError,
  type AccountAuthService,
} from "../auth/AccountAuthService";
import { json, jsonError } from "../http/json";

const registerSchema = z.object({
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email().max(320)),
  loginId: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().min(4).max(24).regex(/^[a-z0-9._-]+$/)),
  password: z.string().min(8).max(128),
  coachName: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(40)),
  schoolName: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(60)),
});

export function createAccountRegisterHandler(auth: AccountAuthService) {
  return async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_registration", "登録内容を確認してください");
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "invalid_registration", "登録内容を確認してください");
    }

    try {
      const result = await auth.register(parsed.data);
      return json(
        {
          session: {
            accessToken: result.session.accessToken,
            refreshToken: result.session.refreshToken,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof AccountConflictError) {
        return jsonError(
          409,
          "account_unavailable",
          "そのIDまたはメールアドレスは使用できません",
        );
      }
      throw error;
    }
  };
}
