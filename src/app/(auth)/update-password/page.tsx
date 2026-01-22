"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient as getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "../_AuthShell";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const UpdatePasswordPage = () => {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Verificar que el usuario tenga una sesión válida de recovery
  useEffect(() => {
    const checkSession = async () => {
      console.log('========== UPDATE-PASSWORD DEBUG ==========');
      console.log('[1] Verificando sesión de recovery...');
      
      // Verificar si hay un code en la URL (viene del callback)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('[2] Code detectado en URL - intercambiando por sesión...');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('[3] ❌ Error al intercambiar code:', exchangeError.message);
          setError("Sesión inválida o expirada. Por favor solicita un nuevo enlace de recuperación.");
          setSessionChecked(true);
          return;
        }
        
        console.log('[3] ✅ Code intercambiado exitosamente');
        
        // Limpiar el code de la URL
        window.history.replaceState({}, '', '/update-password');
      }
      
      // Ahora verificar la sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[4] Session error:', sessionError);
      console.log('[5] Session data:', session ? {
        user_id: session.user.id,
        email: session.user.email,
        recovery_sent_at: session.user.recovery_sent_at,
        aud: session.user.aud,
        role: session.user.role,
        created_at: session.user.created_at
      } : null);
      
      if (!session) {
        console.error('[6] ❌ No hay sesión activa - usuario debe solicitar nuevo link');
        setError("Sesión inválida o expirada. Por favor solicita un nuevo enlace de recuperación.");
      } else {
        console.log('[6] ✅ Sesión de recovery válida para:', session.user.email);
        console.log('[7] Recovery sent at:', session.user.recovery_sent_at);
      }
      
      console.log('==========================================');
      setSessionChecked(true);
    };

    checkSession();
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Contraseña actualizada correctamente");
    setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  return (
    <AuthShell description="Crea una nueva contraseña segura para tu cuenta">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input pr-10"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
              style={{
                color: showPassword ? '#8AAA19' : '#cbd5e1',
                opacity: showPassword ? 1 : 0.6,
              }}
              tabIndex={-1}
            >
              {showPassword ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
            </button>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className="auth-input pr-10"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
              style={{
                color: showConfirmPassword ? '#8AAA19' : '#cbd5e1',
                opacity: showConfirmPassword ? 1 : 0.6,
              }}
              tabIndex={-1}
            >
              {showConfirmPassword ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>

        {message ? <div className="auth-message success">{message}</div> : null}
        {error ? <div className="auth-message error">{error}</div> : null}
      </form>
    </AuthShell>
  );
};

export default UpdatePasswordPage;
