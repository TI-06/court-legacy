import type { AccountAuthService } from "../auth/AccountAuthService";
import type { AuthenticatedRequestHandler } from "../router";
import { json, jsonError } from "../http/json";

export function createAccountProfileHandler(
  auth: AccountAuthService,
): AuthenticatedRequestHandler {
  return async (_request, user) => {
    const profile = await auth.getProfile(user.id);
    if (!profile) {
      return jsonError(
        404,
        "account_profile_not_found",
        "アカウント情報が見つかりません",
      );
    }
    return json({
      loginId: profile.loginId,
      coachName: profile.coachName,
      schoolName: profile.schoolName,
    });
  };
}
