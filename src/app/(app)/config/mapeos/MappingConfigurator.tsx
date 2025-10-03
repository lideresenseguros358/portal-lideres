"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash,
} from "react-icons/fi";

import ChipsEditor from "@/components/ChipsEditor";
import type {
  DelinquencyRule,
  DelinquencyTarget,
  MappingRule,
  Strategy,
  TargetField,
} from "@/lib/types/importing";

interface InsurerOption {
  id: string;
  name: string;
}

interface MappingHeader {
  policy_strategy: Strategy;
  insured_strategy: Strategy;
  commission_strategy: Strategy;
  options: Record<string, unknown>;
}

type EditableRuleBase<TTarget extends string> = {
  target_field: TTarget;
  aliases: string[];
  strategy: Strategy;
  notes: string;
};

type EditableMappingRule = EditableRuleBase<TargetField>;
type EditableDelinquencyRule = EditableRuleBase<DelinquencyTarget>;

interface SnapshotPayload {
  mapping: {
    insurer_id: string;
    policy_strategy: Strategy;
    insured_strategy: Strategy;
    commission_strategy: Strategy;
    options: Record<string, unknown>;
  };
  rules: MappingRule[];
  delinquency: DelinquencyRule[];
}

type ToastType = "success" | "error" | "info";

type Toast = {
  type: ToastType;
  message: string;
};

const strategyOptions: Strategy[] = [
  "by_alias",
  "first_non_zero",
  "penultimate",
  "extract_numeric",
  "custom",
];

const mappingTargetOptions: TargetField[] = [
  "policy",
  "insured",
  "commission",
  "status",
  "days",
  "amount",
];

const delinquencyTargetOptions: DelinquencyTarget[] = [
  "balance",
  "days",
  "status",
  "policy",
  "insured",
];

const emptyMappingRule = (field: TargetField = "policy"): EditableMappingRule => ({
  target_field: field,
  aliases: [],
  strategy: "by_alias",
  notes: "",
});

const emptyDelinquencyRule = (
  field: DelinquencyTarget = "policy"
): EditableDelinquencyRule => ({
  target_field: field,
  aliases: [],
  strategy: "by_alias",
  notes: "",
});

const toEditableMappingRule = (rule: MappingRule): EditableMappingRule => ({
  target_field: rule.target_field,
  aliases: Array.isArray(rule.aliases) ? rule.aliases : [],
  strategy: rule.strategy ?? "by_alias",
  notes: rule.notes ?? "",
});

const toEditableDelinquencyRule = (
  rule: DelinquencyRule
): EditableDelinquencyRule => ({
  target_field: rule.target_field,
  aliases: Array.isArray(rule.aliases) ? rule.aliases : [],
  strategy: rule.strategy ?? "by_alias",
  notes: rule.notes ?? "",
});

export default function MappingConfigurator({
  insurers,
}: {
  insurers: InsurerOption[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [header, setHeader] = useState<MappingHeader | null>(null);
  const [optionsText, setOptionsText] = useState("{}");
  const [mappingRules, setMappingRules] = useState<EditableMappingRule[]>([
    emptyMappingRule(),
  ]);
  const [delinquencyRules, setDelinquencyRules] = useState<
    EditableDelinquencyRule[]
  >([emptyDelinquencyRule("policy")]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({
    header: false,
    rules: false,
    delinquency: false,
  });
  const [toast, setToast] = useState<Toast | null>(null);

  const selectedInsurer = useMemo(
    () => insurers.find((item) => item.id === selectedId) ?? null,
    [insurers, selectedId]
  );

  const filteredInsurers = useMemo(() => {
    if (!search) return insurers;
    const needle = search.toLowerCase();
    return insurers.filter((insurer) =>
      insurer.name.toLowerCase().includes(needle)
    );
  }, [insurers, search]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/config/mappings/${selectedId}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudo obtener la configuración");
        }
        const payload = (await response.json()) as SnapshotPayload;
        if (!cancelled) {
          applySnapshot(payload);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setToast({ type: "error", message: "Error cargando configuración" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedId]);

  const applySnapshot = (snapshot: SnapshotPayload) => {
    const nextHeader: MappingHeader = {
      policy_strategy: snapshot.mapping.policy_strategy ?? "by_alias",
      insured_strategy: snapshot.mapping.insured_strategy ?? "by_alias",
      commission_strategy: snapshot.mapping.commission_strategy ?? "by_alias",
      options: snapshot.mapping.options ?? {},
    };
    setHeader(nextHeader);
    setOptionsText(JSON.stringify(nextHeader.options ?? {}, null, 2));

    const incomingRules = (snapshot.rules ?? []).map(toEditableMappingRule);
    setMappingRules(incomingRules.length ? incomingRules : [emptyMappingRule()]);

    const incomingDelinquency = (snapshot.delinquency ?? []).map(
      toEditableDelinquencyRule
    );
    setDelinquencyRules(
      incomingDelinquency.length
        ? incomingDelinquency
        : [emptyDelinquencyRule("policy")]
    );
  };

  const handleSelect = (insurer: InsurerOption) => {
    setSelectedId(insurer.id);
    setToast(null);
  };

  const parseOptions = (): Record<string, unknown> => {
    try {
      const trimmed = optionsText.trim();
      if (!trimmed) return {};
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Opciones inválidas");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "El JSON de opciones avanzadas es inválido",
      });
      throw error;
    }
  };

  const buildPayload = () => {
    if (!header) return null;
    return {
      mapping: {
        policy_strategy: header.policy_strategy,
        insured_strategy: header.insured_strategy,
        commission_strategy: header.commission_strategy,
        options: parseOptions(),
      },
      rules: mappingRules.map((rule) => ({
        target_field: rule.target_field,
        aliases: rule.aliases,
        strategy: rule.strategy,
        notes: rule.notes.trim() ? rule.notes.trim() : undefined,
      })),
      delinquency: delinquencyRules.map((rule) => ({
        target_field: rule.target_field,
        aliases: rule.aliases,
        strategy: rule.strategy,
        notes: rule.notes.trim() ? rule.notes.trim() : undefined,
      })),
    };
  };

  const persist = async (scope: keyof typeof saving, successMessage: string) => {
    if (!selectedId) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving((prev) => ({ ...prev, [scope]: true }));
    try {
      const response = await fetch(`/api/config/mappings/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message ?? "Error guardando cambios");
      }

      const data = (await response.json()) as SnapshotPayload;
      applySnapshot(data);
      setToast({ type: "success", message: successMessage });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: "No se pudieron guardar los cambios" });
    } finally {
      setSaving((prev) => ({ ...prev, [scope]: false }));
    }
  };

  const handleAddMappingRule = () => {
    setMappingRules((prev) => [...prev, emptyMappingRule()]);
  };

  const handleAddDelinquencyRule = () => {
    setDelinquencyRules((prev) => [...prev, emptyDelinquencyRule("policy")]);
  };

  const updateMappingRule = (
    index: number,
    updater: (rule: EditableMappingRule) => EditableMappingRule
  ) => {
    setMappingRules((prev) =>
      prev.map((rule, position) => (position === index ? updater(rule) : rule))
    );
  };

  const updateDelinquencyRule = (
    index: number,
    updater: (rule: EditableDelinquencyRule) => EditableDelinquencyRule
  ) => {
    setDelinquencyRules((prev) =>
      prev.map((rule, position) => (position === index ? updater(rule) : rule))
    );
  };

  const removeMappingRule = (index: number) => {
    setMappingRules((prev) => prev.filter((_, position) => position !== index));
  };

  const removeDelinquencyRule = (index: number) => {
    setDelinquencyRules((prev) => prev.filter((_, position) => position !== index));
  };

  const handleRevert = async () => {
    if (!selectedId) return;
    setToast(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/config/mappings/${selectedId}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No se pudo recargar la configuración");
      const payload = (await response.json()) as SnapshotPayload;
      applySnapshot(payload);
      setToast({ type: "info", message: "Se restauró la configuración" });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: "No se pudo recargar la configuración" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ToastBanner toast={toast} />

      <section className="card">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--blue,#010139)]">
              Selecciona una aseguradora
            </h2>
            <p className="text-sm text-gray-500">
              Filtra por nombre y carga la configuración asociada.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FiAlertTriangle className="text-[var(--olive,#8aaa19)]" />
            <span>Los cambios afectan los importadores inmediatamente.</span>
          </div>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar aseguradora..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-[var(--blue,#010139)] focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-[var(--blue,#010139)]"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <div className="text-sm text-gray-500">
            {selectedInsurer ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--blue,#010139)]/10 px-3 py-2 font-medium text-[var(--blue,#010139)]">
                {selectedInsurer.name}
                <FiArrowRight />
                Configuración activa
              </span>
            ) : (
              "Sin aseguradora seleccionada"
            )}
          </div>
        </div>

        <div className="mt-4 grid max-h-60 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2 md:grid-cols-2">
          {filteredInsurers.map((insurer) => (
            <button
              key={insurer.id}
              type="button"
              onClick={() => handleSelect(insurer)}
              className={`flex items-center justify-between rounded-lg border px-4 py-2 text-left text-sm transition-all ${
                selectedId === insurer.id
                  ? "border-[var(--blue,#010139)] bg-white shadow-sm"
                  : "border-transparent bg-white hover:border-[var(--olive,#8aaa19)]"
              }`}
            >
              <span className="font-medium text-[var(--blue,#010139)]">
                {insurer.name}
              </span>
              <FiArrowRight className="text-[var(--olive,#8aaa19)]" />
            </button>
          ))}
          {filteredInsurers.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-gray-400">
              No se encontraron aseguradoras.
            </p>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-dashed border-[var(--blue,#010139)] bg-white p-6 text-center text-sm text-[var(--blue,#010139)]">
          Cargando configuración...
        </div>
      ) : null}

      {selectedInsurer && header ? (
        <>
          <section className="card">
            <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--blue,#010139)]">
                  Cabecera de aseguradora
                </h3>
                <p className="text-sm text-gray-500">
                  Define las estrategias globales y opciones avanzadas.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRevert}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--blue,#010139)] px-4 py-2 text-sm font-medium text-[var(--blue,#010139)] transition-transform hover:-translate-y-0.5"
                >
                  <FiRefreshCw />
                  Revertir
                </button>
                <button
                  type="button"
                  onClick={() => persist("header", "Cabecera guardada")}
                  disabled={saving.header}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--blue,#010139)] px-4 py-2 text-sm font-semibold text-white shadow transition-transform hover:-translate-y-0.5 hover:bg-[var(--olive,#8aaa19)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSave />
                  {saving.header ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              <StrategySelector
                label="Estrategia de póliza"
                value={header.policy_strategy}
                onChange={(value) =>
                  setHeader((prev) =>
                    prev
                      ? { ...prev, policy_strategy: value }
                      : prev
                  )
                }
              />
              <StrategySelector
                label="Estrategia de asegurado"
                value={header.insured_strategy}
                onChange={(value) =>
                  setHeader((prev) =>
                    prev
                      ? { ...prev, insured_strategy: value }
                      : prev
                  )
                }
              />
              <StrategySelector
                label="Estrategia de comisión"
                value={header.commission_strategy}
                onChange={(value) =>
                  setHeader((prev) =>
                    prev
                      ? { ...prev, commission_strategy: value }
                      : prev
                  )
                }
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 flex items-center justify-between text-sm font-medium text-[var(--blue,#010139)]">
                Opciones avanzadas (JSON)
                <button
                  type="button"
                  onClick={() =>
                    setOptionsText(
                      JSON.stringify(
                        {
                          commission_groups: [
                            [
                              "Honorarios Profesionales (Monto)",
                              "Honorarios Profesionales",
                              "Monto",
                            ],
                            ["Vida 1er. Año", "Vida Primer Año"],
                            ["Vida renov.", "Vida Renov.", "Vida Renovacion"],
                          ],
                        },
                        null,
                        2
                      )
                    )
                  }
                  className="text-xs text-[var(--olive,#8aaa19)] hover:underline"
                >
                  Insertar ejemplo
                </button>
              </label>
              <textarea
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
                rows={6}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono shadow-inner focus:border-[var(--blue,#010139)] focus:outline-none"
              />
            </div>
          </section>

          <RuleSection<TargetField>
            title="Reglas de importación"
            description="Configura cómo interpretar los campos en archivos de comisiones."
            rules={mappingRules}
            allowedTargets={mappingTargetOptions}
            onAdd={handleAddMappingRule}
            onUpdate={updateMappingRule}
            onRemove={removeMappingRule}
            onSave={() => persist("rules", "Reglas de importación guardadas")}
            saving={saving.rules}
          />

          <RuleSection<DelinquencyTarget>
            title="Reglas de morosidad"
            description="Configura las reglas para conciliaciones y reportes de morosidad."
            rules={delinquencyRules}
            allowedTargets={delinquencyTargetOptions}
            onAdd={handleAddDelinquencyRule}
            onUpdate={updateDelinquencyRule}
            onRemove={removeDelinquencyRule}
            onSave={() =>
              persist("delinquency", "Reglas de morosidad guardadas")
            }
            saving={saving.delinquency}
          />
        </>
      ) : null}
    </div>
  );
}

function StrategySelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Strategy;
  onChange: (value: Strategy) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--blue,#010139)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Strategy)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[var(--blue,#010139)] focus:outline-none"
      >
        {strategyOptions.map((strategy) => (
          <option key={strategy} value={strategy}>
            {strategy}
          </option>
        ))}
      </select>
    </label>
  );
}

interface RuleSectionProps<TTarget extends string> {
  title: string;
  description: string;
  rules: EditableRuleBase<TTarget>[];
  allowedTargets: readonly TTarget[];
  onAdd: () => void;
  onUpdate: (
    index: number,
    updater: (rule: EditableRuleBase<TTarget>) => EditableRuleBase<TTarget>
  ) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  saving: boolean;
}

function RuleSection<TTarget extends string>({
  title,
  description,
  rules,
  allowedTargets,
  onAdd,
  onUpdate,
  onRemove,
  onSave,
  saving,
}: RuleSectionProps<TTarget>) {
  return (
    <section className="card">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--blue,#010139)]">
            {title}
          </h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--olive,#8aaa19)] px-3 py-2 text-sm font-medium text-[var(--olive,#8aaa19)] transition-transform hover:-translate-y-0.5"
          >
            <FiPlus /> Añadir fila
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--blue,#010139)] px-4 py-2 text-sm font-semibold text-white shadow transition-transform hover:-translate-y-0.5 hover:bg-[var(--olive,#8aaa19)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave /> {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={`${rule.target_field}-${index}`}
            className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,160px)_minmax(0,1fr)_minmax(0,200px)] md:items-start md:gap-4">
              <label className="text-sm font-medium text-[var(--blue,#010139)]">
                Campo
                <select
                  value={rule.target_field}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      target_field: event.target.value as TTarget,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm focus:border-[var(--blue,#010139)] focus:outline-none"
                >
                  {allowedTargets.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <ChipsEditor
                label="Aliases"
                values={rule.aliases}
                onChange={(aliases) =>
                  onUpdate(index, (current) => ({ ...current, aliases }))
                }
              />

              <div className="flex flex-col gap-2 md:items-end">
                <label className="text-sm font-medium text-[var(--blue,#010139)]">
                  Estrategia
                  <select
                    value={rule.strategy}
                    onChange={(event) =>
                      onUpdate(index, (current) => ({
                        ...current,
                        strategy: event.target.value as Strategy,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm focus:border-[var(--blue,#010139)] focus:outline-none"
                  >
                    {strategyOptions.map((strategy) => (
                      <option key={strategy} value={strategy}>
                        {strategy}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                >
                  <FiTrash /> quitar
                </button>
              </div>
            </div>

            <label className="mt-3 block text-sm text-gray-500">
              Notas
              <textarea
                value={rule.notes}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[var(--blue,#010139)] focus:outline-none"
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToastBanner({ toast }: { toast: Toast | null }) {
  if (!toast) return null;

  const baseClasses =
    "pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4";
  const toneClasses =
    toast.type === "success"
      ? "bg-green-500"
      : toast.type === "error"
      ? "bg-red-500"
      : "bg-[var(--blue,#010139)]";

  return (
    <div className={baseClasses}>
      <div
        className={`${toneClasses} pointer-events-auto flex max-w-md items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg`}
      >
        {toast.message}
      </div>
    </div>
  );
}
