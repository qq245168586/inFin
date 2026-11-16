import { createBrowserSessionClient } from "../../../../packages/shared/src/browser-session";
import { resolvePublicUrl } from "../config/runtime";

export const browserSession = createBrowserSessionClient("admin-web", "infini-admin-web-session-v2", resolvePublicUrl, "infini-admin-auth");
export { isSessionExpired, BrowserRequestError } from "../../../../packages/shared/src/browser-session";
