export type NoticeTone = "success" | "error";

export interface NoticeState {
  tone: NoticeTone;
  message: string;
}

export interface LegacyEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
}

export interface AuthTokenPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  issued_at?: number;
  expires_at?: number;
}

export interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
  accountNamespace: string;
  environmentLabel?: string;
  gymName?: string;
  role?: string;
  venueId?: string;
  venueName?: string;
}

export interface AuthSession extends AuthTokenPayload, UserProfile {}

export interface LoginFormState {
  username: string;
  password: string;
}

export type CoachPageKey = "console" | "screens";
