import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}