import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyToken, getUserById } from "../localAuth";
import { parse as parseCookies } from "cookie";
import { COOKIE_NAME } from "../../shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Try local JWT authentication first
  const cookies = parseCookies(opts.req.headers.cookie ?? "");
  const sessionCookie = cookies[COOKIE_NAME];

  if (sessionCookie) {
    try {
      const tokenPayload = await verifyToken(sessionCookie);
      if (tokenPayload) {
        const localUser = await getUserById(tokenPayload.userId);
        if (localUser) {
          user = localUser as User;
        }
      }
    } catch (error) {
      // JWT verification failed, try OAuth
    }
  }

  // Fallback to Manus OAuth if local auth didn't work
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
