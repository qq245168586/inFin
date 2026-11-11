import type { AuthSession } from "../models/common";
import { browserSession } from "./browserSession";
export const AUTH_STORAGE_KEY = "infini-coach-web-session-v2";
export const loginCoach = (username: string, password: string) => browserSession.login(username, password) as Promise<AuthSession>;
export const refreshCoachSession = (_token?: string) => browserSession.refresh() as Promise<AuthSession>;

