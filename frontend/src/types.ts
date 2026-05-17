export type AuthMode = "login" | "register";

export type Health = {
  status: string;
  database: string;
};

export type Counts = Record<string, number>;

export type User = {
  id: number;
  email: string;
  name: string;
  role: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

