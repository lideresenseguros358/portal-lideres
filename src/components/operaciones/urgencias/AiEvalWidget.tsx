'use client';

import { useState, useEffect } from 'react';
import {
  FaBrain, FaClock, FaExclamationTriangle, FaCheckCircle,
  FaTimesCircle, FaArrowUp, FaArrowDown, FaMinus,
} from 'react-icons/fa';
import type { OpsAiEvaluation } from '@/types/operaciones.types';

interface Props {
  caseId: string;
}

const SENTIMENT_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof FaCheckCircle }> = {
  positive: { bg: 'bg-green-100', text: 'text-green-700', label: 'Positivo', icon: FaCheckCircle },
  neutral:  { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Neutral', icon: FaMinus },
  negative: { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Negativo', icon: FaTimesCircle },
};

export default function AiEvalWidget({ caseId }: Props) {
  const [evaluation, setEvaluation] = useState<OpsAiEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/operaciones/ai-eval?case_id=${caseId}`);
        const json = await res.json();
        setEvaluation(json.evaluation || null);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, [caseId]);

  if (loading) {
    return (
      <div className="bg-gray-50/80 rounded-xl p-4 ops-skeleton space-y-2">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-6 bg-gray-100 rounded w-1/2" />
        <div className="h-2.5 bg-gray-50 rounded w-full" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <FaBrain className="text-gray-300 text-xs" />
          <span className="text-[10px] font-medium text-gray-400">IA Evaluación</span>
        </div>
        <p className="text-[10px] text-gray-400">
          Pendiente — la evaluación se genera al cerrar o resolver el caso.
        </p>
      </div>
    );
  }

  const eff = evaluation.effectiveness_score;
  const sentDefault = { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Neutral', icon: FaMinus as typeof FaCheckCircle };
  const sent = SENTIMENT_STYLES[evaluation.final_sentiment_label] || sentDefault;
  const SentIcon = sent.icon;
  const evidence = evaluation.evidence || {};
  const improvements: string[] = evidence.improvements || [];
  const signals = evaluation.unresolved_signals || [];

  // Effectiveness color
  const effColor = eff >= 70 ? 'text-green-600' : eff >= 40 ? 'text-amber-600' : 'text-red-600';
  const effBg = eff >= 70 ? 'bg-green-50' : eff >= 40 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#010139] px-4 py-2 flex items-center gap-2">
        <FaBrain className="text-white/60 text-xs" />
        <span className="text-xs font-medium text-white/90">Evaluación IA</span>
        <span className="ml-auto text-[9px] text-white/30">
          {evaluation.evaluator_version} · {new Date(evaluation.evaluated_at).toLocaleDateString('es-PA')}
        </span>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Score + Sentiment Row */}
        <div className="flex items-center gap-2">
          {/* Effectiveness score */}
          <div className={`${effBg} rounded-lg px-3 py-2.5 text-center min-w-[80px]`}>
            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">Efectividad</p>
            <p className={`text-xl font-bold ${effColor}`}>{eff}%</p>
          </div>

          {/* Sentiment */}
          <div className={`${sent.bg} rounded-lg px-3 py-2.5 flex items-center gap-2 flex-1`}>
            <SentIcon className={`${sent.text} text-sm`} />
            <div>
              <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">Sentimiento</p>
              <p className={`text-xs font-semibold ${sent.text}`}>{sent.label}</p>
              <p className="text-[9px] text-gray-400">{evaluation.final_sentiment_score}/100</p>
            </div>
          </div>

          {/* Response time */}
          {evidence.first_response_hours !== undefined && (
            <div className="bg-gray-50/80 rounded-lg px-3 py-2.5 text-center min-w-[80px]">
              <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">1a Resp.</p>
              <p className={`text-xs font-semibold ${evidence.first_response_hours > 24 ? 'text-red-600' : 'text-gray-700'}`}>
                {Number(evidence.first_response_hours).toFixed(1)}h
              </p>
            </div>
          )}
        </div>

        {/* Escalation warning */}
        {evaluation.escalation_recommended && (
          <div className="bg-red-50/60 border border-red-100 rounded-lg p-2.5 flex items-center gap-2">
            <FaExclamationTriangle className="text-red-400 text-[10px] flex-shrink-0" />
            <p className="text-[10px] font-medium text-red-600">Escalamiento recomendado por IA</p>
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">Señales detectadas</p>
            <div className="flex flex-wrap gap-1">
              {signals.map((s: string, i: number) => (
                <span key={i} className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-100">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rationale */}
        {evaluation.rationale && (
          <div className="bg-gray-50/80 rounded-lg p-2.5">
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Análisis IA</p>
            <p className="text-[10px] text-gray-600">{evaluation.rationale}</p>
          </div>
        )}

        {/* Improvements */}
        {improvements.length > 0 && (
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">Qué mejorar</p>
            <ul className="space-y-0.5">
              {improvements.map((imp: string, i: number) => (
                <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
                  <span className="text-[#8AAA19] mt-0.5 text-[8px]">•</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SLA breach indicator */}
        {evidence.sla_breached && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-medium">
            <FaClock className="text-[9px]" />
            SLA excedido — penalización aplicada al score
          </div>
        )}
      </div>
    </div>
  );
}
