import { browserSession } from "../browserSession";
export interface AuthTokenPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  issued_at?: number;
  expires_at?: number;
}

export interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
}

export type AuthSession = AuthTokenPayload & Partial<UserProfile>;


export const loginWithPassword = browserSession.login;
export const refreshWithToken = (_token?: string) => browserSession.refresh();
export async function fetchProfile(_type?: string, _token?: string): Promise<Partial<UserProfile>> {
  return (await browserSession.requestJson<{data: UserProfile}>("/api/user/info")).data;
}
