'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';

interface Bank {
  id: string;
  bank_name: string;
  route_code: string;
}

interface AccountType {
  id: string;
  code: string;
  name: string;
}

interface BankSelectProps {
  value: string;
  onChange: (bankRoute: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown de bancos con códigos de ruta ACH
 * Carga bancos activos desde la tabla ach_banks
 */
export function BankSelect({ 
  value, 
  onChange, 
  required = false,
  disabled = false,
  className = ''
}: BankSelectProps) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabaseClient()
        .from('ach_banks')
        .select('id, bank_name, route_code')
        .eq('status', 'ACTIVE')
        .order('bank_name', { ascending: true });

      if (fetchError) {
        console.error('Error loading banks:', fetchError);
        setError('Error al cargar bancos');
        return;
      }

      setBanks(data || []);
    } catch (err) {
      console.error('Error loading banks:', err);
      setError('Error al cargar bancos');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  if (loading) {
    return (
      <select
        disabled
        className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 ${className}`}
      >
        <option>Cargando bancos...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select
        disabled
        className={`w-full px-4 py-2 border-2 border-red-300 rounded-lg bg-red-50 ${className}`}
      >
        <option>Error al cargar bancos</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${className}`}
    >
      <option value="">Seleccionar banco...</option>
      {banks.map((bank) => (
        <option key={bank.id} value={bank.route_code}>
          {bank.bank_name}
        </option>
      ))}
    </select>
  );
}

/**
 * Dropdown de tipo de cuenta ACH
 * Carga desde tabla ach_account_types (solo 03 y 04)
 */
export function AccountTypeSelect({
  value,
  onChange,
  required = false,
  disabled = false,
  className = ''
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccountTypes();
  }, []);

  const loadAccountTypes = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabaseClient()
        .from('ach_account_types')
        .select('id, code, name')
        .eq('status', 'ACTIVE')
        .order('code', { ascending: true });

      if (fetchError) {
        console.error('Error loading account types:', fetchError);
        setError('Error al cargar tipos de cuenta');
        return;
      }

      setAccountTypes(data || []);
    } catch (err) {
      console.error('Error loading account types:', err);
      setError('Error al cargar tipos de cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <select
        disabled
        className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 ${className}`}
      >
        <option>Cargando tipos...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select
        disabled
        className={`w-full px-4 py-2 border-2 border-red-300 rounded-lg bg-red-50 ${className}`}
      >
        <option>Error al cargar tipos</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${className}`}
    >
      <option value="">Seleccionar tipo...</option>
      {accountTypes.map((type) => (
        <option key={type.id} value={type.code}>
          {type.name}
        </option>
      ))}
    </select>
  );
}
