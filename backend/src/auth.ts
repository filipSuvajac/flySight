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
  return process.env.JWT_SECRET || fallbackSecret;
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

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
  return {
    id: Number(decoded.sub),
    email: decoded.email,
    name: decoded.name
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
