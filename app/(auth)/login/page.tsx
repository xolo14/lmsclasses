import { LoginForm } from "./LoginForm";

function googleLoginEnabled() {
  return !!(
    (process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim()) &&
    (process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim())
  );
}

export default function LoginPage() {
  return <LoginForm googleEnabled={googleLoginEnabled()} />;
}
