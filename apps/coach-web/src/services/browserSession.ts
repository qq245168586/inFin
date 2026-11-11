import { createBrowserSessionClient } from "../../../../packages/shared/src/browser-session";
import { resolvePublicUrl } from "../config/runtime";

export const browserSession = createBrowserSessionClient("coach-web", "infini-coach-web-session-v2", resolvePublicUrl, "infini-coach-web-auth");
export { isSessionExpired, BrowserRequestError } from "../../../../packages/shared/src/browser-session";
