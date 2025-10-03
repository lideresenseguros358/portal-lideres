"use client";

import { FormEvent, useEffect, useState } from "react";

import AuthShell from "../_AuthShell";

const initialBroker = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  taxId: "",
  address: "",
};

const initialAccount = {
  bankName: "",
  accountNumber: "",
  accountType: "",
  beneficiaryName: "",
};

const NewUserPage = () => {
  const [broker, setBroker] = useState(initialBroker);
  const [account, setAccount] = useState(initialAccount);
  const [sameAccount, setSameAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBrokerChange = (field: keyof typeof initialBroker, value: string) => {
    setBroker((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountChange = (field: keyof typeof initialAccount, value: string) => {
    setAccount((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const requiredBroker = ["firstName", "lastName", "email", "phone", "company"] as const;
    for (const key of requiredBroker) {
      if (!broker[key]) {
        setError("Completa la información del corredor");
        return;
      }
    }

    if (!sameAccount) {
      const requiredAccount = ["bankName", "accountNumber", "accountType", "beneficiaryName"] as const;
      for (const key of requiredAccount) {
        if (!account[key]) {
          setError("Completa la información de la cuenta para comisiones");
          return;
        }
      }
    }

    setLoading(true);

    const preparedAccount = sameAccount
      ? {
          bankName: broker.company,
          accountNumber: broker.taxId,
          accountType: account.accountType || "corriente",
          beneficiaryName: `${broker.firstName} ${broker.lastName}`.trim(),
        }
      : account;

    const payload = {
      broker,
      account: preparedAccount,
      submittedAt: new Date().toISOString(),
    };

    console.info("[new-user] payload listo para envío futuro", payload);

    setTimeout(() => {
      setLoading(false);
      setMessage("Solicitud enviada; pendiente aprobación de MASTER");
      setBroker(initialBroker);
      setAccount(initialAccount);
      setSameAccount(false);
    }, 400);
  };

  useEffect(() => {
    if (sameAccount) {
      setAccount((prev) => ({
        ...prev,
        bankName: broker.company,
        accountNumber: broker.taxId,
        beneficiaryName: `${broker.firstName} ${broker.lastName}`.trim(),
      }));
    }
  }, [sameAccount, broker]);

  return (
    <AuthShell backHref="/login" description="Registra tu solicitud para acceder al portal">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-section">
          <h3 className="auth-section-title">Datos del corredor</h3>

          <div className="auth-grid">
            <div className="auth-field">
              <label className="auth-label" htmlFor="firstName">
                Nombre(s)
              </label>
              <input
                id="firstName"
                className="auth-input"
                value={broker.firstName}
                onChange={(event) => handleBrokerChange("firstName", event.target.value)}
                placeholder="Juan"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="lastName">
                Apellido(s)
              </label>
              <input
                id="lastName"
                className="auth-input"
                value={broker.lastName}
                onChange={(event) => handleBrokerChange("lastName", event.target.value)}
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="auth-grid">
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                Correo corporativo
              </label>
              <input
                id="email"
                type="email"
                className="auth-input"
                value={broker.email}
                onChange={(event) => handleBrokerChange("email", event.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="phone">
                Teléfono de contacto
              </label>
              <input
                id="phone"
                className="auth-input"
                value={broker.phone}
                onChange={(event) => handleBrokerChange("phone", event.target.value)}
                placeholder="+507 6000-0000"
              />
            </div>
          </div>

          <div className="auth-grid">
            <div className="auth-field">
              <label className="auth-label" htmlFor="company">
                Razón social
              </label>
              <input
                id="company"
                className="auth-input"
                value={broker.company}
                onChange={(event) => handleBrokerChange("company", event.target.value)}
                placeholder="Líderes en Seguros"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="taxId">
                RUC / Identificación fiscal
              </label>
              <input
                id="taxId"
                className="auth-input"
                value={broker.taxId}
                onChange={(event) => handleBrokerChange("taxId", event.target.value)}
                placeholder="8-888-888"
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="address">
              Dirección fiscal
            </label>
            <textarea
              id="address"
              className="auth-textarea"
              rows={3}
              value={broker.address}
              onChange={(event) => handleBrokerChange("address", event.target.value)}
              placeholder="Ciudad de Panamá, Panamá"
            />
          </div>
        </div>

        <div className="auth-section">
          <h3 className="auth-section-title">Cuenta para comisiones</h3>
          <p className="auth-section-subtitle">Puedes utilizar la misma información del corredor</p>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={sameAccount}
              onChange={(event) => setSameAccount(event.target.checked)}
            />
            Es la misma del corredor
          </label>

          {!sameAccount ? (
            <>
              <div className="auth-grid">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="bankName">
                    Banco
                  </label>
                  <input
                    id="bankName"
                    className="auth-input"
                    value={account.bankName}
                    onChange={(event) => handleAccountChange("bankName", event.target.value)}
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="accountNumber">
                    Número de cuenta
                  </label>
                  <input
                    id="accountNumber"
                    className="auth-input"
                    value={account.accountNumber}
                    onChange={(event) => handleAccountChange("accountNumber", event.target.value)}
                  />
                </div>
              </div>

              <div className="auth-grid">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="accountType">
                    Tipo de cuenta
                  </label>
                  <input
                    id="accountType"
                    className="auth-input"
                    value={account.accountType}
                    onChange={(event) => handleAccountChange("accountType", event.target.value)}
                    placeholder="Corriente / Ahorros"
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="beneficiaryName">
                    Beneficiario
                  </label>
                  <input
                    id="beneficiaryName"
                    className="auth-input"
                    value={account.beneficiaryName}
                    onChange={(event) => handleAccountChange("beneficiaryName", event.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? "Enviando solicitud..." : "Enviar solicitud"}
        </button>

        {error ? <div className="auth-message error">{error}</div> : null}
        {message ? <div className="auth-message success">{message}</div> : null}
      </form>
    </AuthShell>
  );
};

export default NewUserPage;
