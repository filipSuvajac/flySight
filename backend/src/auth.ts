import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
};

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
};

const fallbackSecret = "flysight-dev-secret-change-me";

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured in production.");
  }

  return secret || fallbackSecret;
}

export function signToken(user: AuthUser) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "2h") as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name
    } satisfies JwtPayload,
    jwtSecret(),
    options
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
    req.user = {
      id: Number(decoded.sub),
      email: decoded.email,
      name: decoded.name
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
