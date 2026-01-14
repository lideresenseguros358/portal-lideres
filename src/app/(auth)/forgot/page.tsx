"use client";

import { FormEvent, useMemo, useState } from "react";

import AuthShell from "../_AuthShell";
import { supabaseClient as getSupabaseClient } from "@/lib/supabase/client";
import { getPasswordRecoveryUrl } from "@/lib/auth/redirect";

const ForgotPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!email) {
      setError("Ingresa un correo válido");
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRecoveryUrl(),
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Hemos enviado instrucciones para restablecer tu contraseña");
  };

  return (
    <AuthShell backHref="/login" description="Recupera el acceso a tu cuenta">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            className="auth-input"
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? "Enviando..." : "Enviar instrucciones"}
        </button>

        {error ? <div className="auth-message error">{error}</div> : null}
        {message ? <div className="auth-message success">{message}</div> : null}
      </form>
    </AuthShell>
  );
};

export default ForgotPage;
