"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "../_AuthShell";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = supabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Force a full page reload to update cookies
      window.location.href = "/dashboard";
    }
  };

  return (
    <AuthShell description="Ingresa tus credenciales para acceder a tu cuenta.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="auth-input"
            placeholder="Correo electrónico"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="auth-input pr-10"
              placeholder="Ingresa tu contraseña"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-no-uppercase
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

        {error && (
          <div className="auth-message error">{error}</div>
        )}

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? (
            <span className="button-content">
              <svg className="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  opacity="0.25"
                />
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  strokeDasharray="63"
                  strokeDashoffset="50"
                  className="spinner-circle"
                />
              </svg>
              <span>Ingresando...</span>
            </span>
          ) : (
            "Ingresar"
          )}
        </button>
        
        <style jsx>{`
          .button-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .spinner {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
          }
          
          .spinner-circle {
            animation: spin 0.8s linear infinite;
            transform-origin: center;
          }
          
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div className="auth-inline-links">
          <Link href="/forgot">Olvidé contraseña</Link>
          <span>|</span>
          <Link href="/new-user">¿Nuevo Usuario?</Link>
        </div>
      </form>
    </AuthShell>
  );
};
