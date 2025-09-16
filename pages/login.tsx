// pages/login.tsx
"use client"; // si estás usando app router, pon esto arriba
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase-client"; // ajusta la ruta si es distinta

// colores
const OLIVE = "#8aaa19";
const FOOTER_BLUE = "#010139";
const SUBTITLE_GRAY = "#6b6b6b";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      // signInWithPassword v2
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(error.message || "Error en autenticación");
        setLoading(false);
        return;
      }

      // si se autentica correctamente, redirige según rol o a /app/master o /app/broker
      // Si guardas role en profile, fetchéalo aquí y redirige.
      // Ejemplo simple: redirige a /app/dashboard (ajusta)
      router.replace("/app");
    } catch (err: any) {
      setMsg(String(err?.message ?? err ?? "Error inesperado"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Header: franja blanca con logo a la izquierda */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoWrap}>
            {/* Ajusta el src con tu logo o usa <Image /> */}
            <img src="/logo.png" alt="LISSA" style={styles.logo} />
          </div>
        </div>
      </header>

      {/* Background image */}
      <div style={styles.bg} />

      {/* Card centrado */}
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>Portal Virtual</h1>
          <h2 style={styles.roleTitle}>Corredores</h2>
          <p style={styles.subtitle}>Ingrese su usuario y contraseña</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              aria-label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@lideresenseguros.com"
              style={styles.input}
              required
            />
            <input
              aria-label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              style={styles.input}
              required
            />

            {msg && <div style={styles.error}>{msg}</div>}

            <button style={styles.button} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div style={styles.links}>
              <Link href="/app/auth/forgot" legacyBehavior>
                <a style={styles.link}>¿Olvidaste tu contraseña?</a>
              </Link>
              <Link href="/app/auth/signup-request" legacyBehavior>
                <a style={styles.link}>Solicitar nuevo usuario</a>
              </Link>
            </div>
          </form>
        </div>
      </main>

      {/* Footer franja azul */}
      <footer style={styles.footerBar}>
        <div style={styles.footerTextWrap}>
          <div style={styles.footerLineSmall}>
            Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750
          </div>
          <div style={styles.footerLineTiny}>
            Desarrollado por Líderes en Seguros | Todos los derechos reservados
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Styles inline para no tocar CSS externo; puedes convertir a CSS module si prefieres */
const styles: { [k: string]: React.CSSProperties } = {
  page: { minHeight: "100vh", position: "relative", fontFamily: "Arial, sans-serif" },
  header: {
    background: "#fff",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.03)",
    position: "relative",
    zIndex: 40
  },
  headerInner: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center" },
  logoWrap: { width: 140 },
  logo: { maxWidth: "140px", height: "auto", objectFit: "contain" },

  bg: {
    backgroundImage: "url('/hero-panama.jpg')",
    backgroundPosition: "center",
    backgroundSize: "cover",
    position: "absolute",
    top: 64, // header height
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    filter: "brightness(0.95)"
  },

  main: {
    zIndex: 50,
    position: "relative",
    minHeight: "calc(100vh - 220px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px"
  },
  card: {
    width: "min(760px, 90%)",
    background: "rgba(255,255,255,0.98)",
    borderRadius: 12,
    padding: "28px 32px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    textAlign: "center",
    zIndex: 60
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "#111" },
  roleTitle: { margin: "6px 0 0", fontSize: 18, color: OLIVE, fontWeight: 700 },
  subtitle: { margin: "8px 0 18px", color: SUBTITLE_GRAY, fontSize: 14 },

  form: { display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" },
  input: {
    height: 44,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14,
    outline: "none",
  },
  button: {
    height: 46,
    background: "#0b1b2f",
    color: "#fff",
    fontWeight: 700,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
  links: { display: "flex", justifyContent: "center", gap: 20, marginTop: 8 },
  link: { color: SUBTITLE_GRAY, fontSize: 13, textDecoration: "underline", cursor: "pointer" },
  error: { color: "crimson", fontSize: 13, textAlign: "center", marginTop: 6 },

  footerBar: {
    background: FOOTER_BLUE,
    color: "#fff",
    paddingTop: 16,
    paddingBottom: 28,
    marginTop: 24
  },
  footerTextWrap: { maxWidth: 1100, margin: "0 auto", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.85)" },
  footerLineSmall: { fontSize: 12, marginBottom: 6 },
  footerLineTiny: { fontSize: 9, opacity: 0.85 }
};
