"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/feedback";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    // With email confirmation on, signUp succeeds but returns no session.
    if (signup && !data.session) { setSignup(false); return toast("Cuenta creada. Revisa tu correo para confirmarla y luego entra.", "info"); }
    router.push("/");
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{signup ? "Crear cuenta" : "Entrar"}</h1>
      <Field label="Correo"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña">
        <Input type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <ErrorBox message={error} />}
      <Button type="submit" loading={busy} className="w-full">{signup ? "Crear cuenta" : "Entrar"}</Button>
      <button type="button" onClick={() => setSignup(!signup)} className="text-sm text-accent">
        {signup ? "Ya tengo cuenta" : "No tengo cuenta"}
      </button>
    </form>
  );
}
