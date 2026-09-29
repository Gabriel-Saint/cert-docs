import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'certdocs_session';
export const SESSION_COOKIE_PATH = '/api';
export const SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: SESSION_COOKIE_PATH,
  };
}