import { createBrowserSessionClient } from "../../../../packages/shared/src/browser-session";
import { resolvePublicUrl } from "../config/runtime";

export const browserSession = createBrowserSessionClient("course-web", "infini-course-web-session-v2", resolvePublicUrl, "infini-course-web-auth");
export { isSessionExpired, BrowserRequestError } from "../../../../packages/shared/src/browser-session";
