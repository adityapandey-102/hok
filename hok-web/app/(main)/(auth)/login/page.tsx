import { Suspense } from "react";
import { LoginForm } from "../../../../modules/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
