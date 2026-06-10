import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role?: string;
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
      name: user.name,
      role: user.role === "admin" ? "admin" : "user"
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
    name: decoded.name,
    role: decoded.role === "admin" ? "admin" : "user"
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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}
