"use client";

import { useState } from "react";

interface ChipsEditorProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  addLabel?: string;
}

const normalize = (value: string) => value.trim();

export default function ChipsEditor({
  label,
  values,
  onChange,
  placeholder = "Agregar alias...",
  disabled = false,
  addLabel = "Añadir",
}: ChipsEditorProps) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const value = normalize(draft);
    if (!value || disabled) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (value: string) => {
    if (disabled) return;
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <span className="text-sm font-medium text-[var(--blue,#010139)]">{label}</span>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--blue,#010139)]/10 px-3 py-1 text-xs font-medium text-[var(--blue,#010139)]"
          >
            {value}
            {!disabled ? (
              <button
                type="button"
                onClick={() => handleRemove(value)}
                className="text-[var(--blue,#010139)]/70 hover:text-red-500"
                aria-label={`Eliminar ${value}`}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {values.length === 0 ? (
          <span className="text-xs text-gray-400">Sin aliases configurados.</span>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[var(--blue,#010139)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--olive,#8aaa19)] px-3 py-2 text-sm font-medium text-[var(--olive,#8aaa19)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
