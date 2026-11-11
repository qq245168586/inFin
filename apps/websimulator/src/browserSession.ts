import { createBrowserSessionClient } from "../../../packages/shared/src/browser-session";
import { resolvePublicUrl } from "./runtime";
export const browserSession = createBrowserSessionClient("course-web", "infini-course-web-session-v2", resolvePublicUrl);
