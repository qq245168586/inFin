import { browserSession } from "./browserSession";
export const requestJson = browserSession.requestJson;
export function authHeaders(tokenType: string, accessToken: string): Record<string, string> {
  return { Authorization: `${tokenType} ${accessToken}` };
}
