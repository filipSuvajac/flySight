import type { AuthMode, Health } from "../types";
import { AuthLanding } from "../components/AuthLanding";

type AuthPageProps = {
  mode: AuthMode;
  email: string;
  name: string;
  password: string;
  health: Health | null;
  error: string;
  message: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (mode: AuthMode) => void;
};

export function AuthPage(props: AuthPageProps) {
  return <AuthLanding {...props} />;
}

