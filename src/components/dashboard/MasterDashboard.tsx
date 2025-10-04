import Link from "next/link";

import KpiCard from "./KpiCard";
import BarYtd from "./BarYtd";
import {
  getFortnightStatus,
  getNetCommissions,
  getAnnualNet,
  getPendingCases,
  getYtdComparison,
  getProductionData,
  getBrokerRanking,
  getBrokerOfTheMonth,
  getOperationsData,
  getFinanceData,
} from "@/lib/dashboard/queries";
import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import type { DashboardRole } from "@/lib/dashboard/types";

const ROLE: DashboardRole = "master";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const formatFortnightRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const rangeFormatter = new Intl.DateTimeFormat("es-PA", {
    day: "2-digit",
    month: "short",
  });
  return `${rangeFormatter.format(new Date(start))} – ${rangeFormatter.format(new Date(end))}`;
};

interface MasterDashboardProps {
  userId: string;
}

const MasterDashboard = async ({ userId }: MasterDashboardProps) => {
  const supabase = await getSupabaseServer();
  const profilePromise = supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle<Pick<Tables<"profiles">, "full_name">>();

  const [
    profileResult, 
    fortnightStatus, 
    netCommissions, 
    annualNet, 
    pendingCases, 
    ytdComparison,
    productionData,
    brokerRanking,
    brokerOfTheMonth,
    operationsData,
    financeData
  ] = await Promise.all([
    profilePromise,
    getFortnightStatus(userId, ROLE),
    getNetCommissions(userId, ROLE),
    getAnnualNet(userId, ROLE),
    getPendingCases(),
    getYtdComparison(userId, ROLE),
    getProductionData(),
    getBrokerRanking(),
    getBrokerOfTheMonth(),
    getOperationsData(),
    getFinanceData(),
  ]);

  const profileName = profileResult.data?.full_name ?? "Equipo LISSA";
  const openRange = formatFortnightRange(fortnightStatus.open?.fortnight.period_start, fortnightStatus.open?.fortnight.period_end);
  const paidRange = formatFortnightRange(fortnightStatus.paid?.fortnight.period_start, fortnightStatus.paid?.fortnight.period_end);

  return (
    <div className="master-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Panel Administrativo LISSA</h1>
        <p className="dashboard-welcome">Bienvenido de vuelta, {profileName}</p>
      </div>

      {/* Bloque 1 - Producción */}
      <div className="dashboard-section">
        <h2 className="section-title">Producción</h2>
        
        {/* KPIs de Producción */}
        <div className="kpi-grid">
          <KpiCard
            title="PMA Total año en curso"
            value={formatCurrency(productionData.totalPMA)}
            subtitle={`Año ${productionData.year}`}
          />
          <KpiCard
            title="YTD vs Año pasado"
            value={`${productionData.deltaPercent > 0 ? '+' : ''}${productionData.deltaPercent.toFixed(1)}%`}
            subtitle={`${formatCurrency(productionData.totalPMA)} vs ${formatCurrency(productionData.previousTotal)}`}
          />
        </div>
        
        {/* Gráfica de barras mensual */}
        <div className="mt-6">
          <Link href="/production" className="block">
            <BarYtd current={ytdComparison.current} last={ytdComparison.previous} />
          </Link>
        </div>
        
        {/* Ranking de brokers */}
        <div className="ranking-section mt-6">
          <h3 className="subsection-title">Top 5 Corredores (YTD)</h3>
          <div className="ranking-list">
            {brokerRanking.map((broker, index) => {
              const getMedalEmoji = (position: number) => {
                if (position === 1) return '🥇';
                if (position === 2) return '🥈';
                if (position === 3) return '🥉';
                return null;
              };
              const medal = getMedalEmoji(index + 1);
              
              return (
                <Link href="/production" key={broker.brokerId} className="ranking-item-link">
                  <div className="ranking-item">
                    <div className="ranking-medal-container">
                      {medal ? (
                        <span className="ranking-medal">{medal}</span>
                      ) : (
                        <span className="ranking-position">{index + 1}</span>
                      )}
                    </div>
                    <span className="ranking-name">{broker.brokerName}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          {brokerOfTheMonth && (
            <div className="broker-of-month">
              <p className="broker-of-month-text">
                🏆 <strong>Corredor del mes de {brokerOfTheMonth.monthName}:</strong> {brokerOfTheMonth.brokerName}
              </p>
            </div>
          )}
          <Link href="/production" className="view-more">Ver ranking completo →</Link>
        </div>
      </div>

      {/* Bloque 2 - Operaciones */}
      <div className="dashboard-section">
        <h2 className="section-title">Operaciones</h2>
        
        {/* Trámites */}
        <div className="subsection">
          <h3 className="subsection-title">Trámites</h3>
          <div className="status-cards">
            <Link href="/pendientes?status=IN_PROGRESS" className="status-card">
              <span className="status-value">{operationsData.cases.enTramite}</span>
              <span className="status-label">En trámite</span>
            </Link>
            <Link href="/pendientes?status=PENDING_INFO" className="status-card">
              <span className="status-value">{operationsData.cases.pendienteInfo}</span>
              <span className="status-label">Pendiente info</span>
            </Link>
            <Link href="/pendientes?status=POSTPONED" className="status-card blue">
              <span className="status-value">{operationsData.cases.aplazado}</span>
              <span className="status-label">Aplazado</span>
            </Link>
            <Link href="/pendientes?status=ISSUED" className="status-card">
              <span className="status-value">{operationsData.cases.emitido}</span>
              <span className="status-label">Emitido</span>
            </Link>
            <Link href="/pendientes?status=CLOSED" className="status-card">
              <span className="status-value">{operationsData.cases.cerrado}</span>
              <span className="status-label">Cerrado</span>
            </Link>
          </div>
        </div>
        
        {/* Renovaciones */}
        <div className="subsection">
          <h3 className="subsection-title">Renovaciones próximas</h3>
          <div className="renewal-cards">
            <Link href="/db?renewals=30" className="renewal-card">
              <span className="renewal-value">{operationsData.renewals.days30}</span>
              <span className="renewal-label">30 días</span>
            </Link>
            <Link href="/db?renewals=60" className="renewal-card">
              <span className="renewal-value">{operationsData.renewals.days60}</span>
              <span className="renewal-label">60 días</span>
            </Link>
            <Link href="/db?renewals=90" className="renewal-card">
              <span className="renewal-value">{operationsData.renewals.days90}</span>
              <span className="renewal-label">90 días</span>
            </Link>
          </div>
        </div>
        
        {/* Morosidad */}
        <div className="subsection">
          <h3 className="subsection-title">Morosidad</h3>
          <div className="morosidad-card">
            <span className="morosidad-label">Total vencido</span>
            <span className="morosidad-value">{formatCurrency(operationsData.delinquency.totalVencido)}</span>
          </div>
        </div>
      </div>

      {/* Bloque 3 - Finanzas */}
      <div className="dashboard-section">
        <h2 className="section-title">Finanzas</h2>
        
        {/* Comisiones */}
        <div className="subsection">
          <h3 className="subsection-title">Comisiones</h3>
          <div className="kpi-grid">
            <Link href="/commissions" className="block">
              <KpiCard
                title="Comisiones netas"
                value={formatCurrency(financeData.lastPaidAmount)}
                subtitle="Última quincena pagada"
              />
            </Link>
            <Link href="/commissions" className="block">
              <KpiCard
                title="Acumulado anual"
                value={formatCurrency(financeData.annualAccumulated)}
                subtitle={`Año ${new Date().getFullYear()}`}
              />
            </Link>
          </div>
        </div>
        
        {/* Cheques */}
        <div className="subsection">
          <h3 className="subsection-title">Cheques</h3>
          <div className="check-cards">
            <div className="check-card">
              <span className="check-label">Recibido</span>
              <span className="check-value">{formatCurrency(financeData.checks.received)}</span>
            </div>
            <div className="check-card">
              <span className="check-label">Aplicado</span>
              <span className="check-value">{formatCurrency(financeData.checks.applied)}</span>
            </div>
            <div className="check-card">
              <span className="check-label">Pendiente</span>
              <span className="check-value">{formatCurrency(financeData.checks.pending)}</span>
            </div>
            <div className="check-card">
              <span className="check-label">Devoluciones</span>
              <span className="check-value">{formatCurrency(financeData.checks.returned)}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .master-dashboard {
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .dashboard-header {
          margin-bottom: 32px;
        }
        
        .dashboard-title {
          font-size: 32px;
          font-weight: 700;
          color: #010139;
          text-align: center;
          margin-bottom: 8px;
        }
        
        .dashboard-welcome {
          text-align: center;
          color: #666;
          font-size: 16px;
        }
        
        .dashboard-section {
          background: white;
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        .section-title {
          font-size: 24px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 24px;
          text-align: center;
        }
        
        .subsection {
          margin-top: 32px;
        }
        
        .subsection-title {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 16px;
          text-align: center;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }
        
        .mt-6 {
          margin-top: 24px;
        }
        
        /* Ranking */
        .ranking-section {
          background: #f6f6ff;
          border-radius: 12px;
          padding: 20px;
        }
        
        .ranking-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .ranking-item-link {
          text-decoration: none;
          color: inherit;
          display: block;
          transition: transform 0.2s;
        }
        
        .ranking-item-link:hover {
          transform: translateX(4px);
        }
        
        .ranking-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: white;
          border-radius: 8px;
          border: 2px solid transparent;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .ranking-item-link:hover .ranking-item {
          border-color: #8aaa19;
          box-shadow: 0 2px 8px rgba(138, 170, 25, 0.15);
        }
        
        .ranking-medal-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
        }
        
        .ranking-medal {
          font-size: 28px;
          line-height: 1;
        }
        
        .ranking-position {
          font-size: 20px;
          font-weight: bold;
          color: #010139;
          width: 30px;
          text-align: center;
        }
        
        .ranking-name {
          flex: 1;
          font-weight: 600;
          color: #010139;
          text-align: center;
        }
        
        .broker-of-month {
          margin-top: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #fff9e6 0%, #fff4d6 100%);
          border-radius: 8px;
          border: 2px solid #ffd700;
        }
        
        .broker-of-month-text {
          text-align: center;
          color: #010139;
          font-size: 14px;
          margin: 0;
        }
        
        .view-more {
          display: block;
          text-align: right;
          margin-top: 16px;
          color: #8aaa19;
          font-weight: 600;
          text-decoration: none;
        }
        
        .view-more:hover {
          color: #6f8815;
        }
        
        /* Status cards */
        .status-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }
        
        .status-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: white;
          border: 2px solid #f0f0f0;
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s, border-color 0.2s;
        }
        
        .status-card:hover {
          transform: translateY(-2px);
          border-color: #8aaa19;
        }
        
        .status-card.blue {
          border-color: #010139;
        }
        
        .status-value {
          font-size: 28px;
          font-weight: bold;
          color: #010139;
        }
        
        .status-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        
        /* Renewal cards */
        .renewal-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        
        .renewal-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #f6f6ff;
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s;
        }
        
        .renewal-card:hover {
          transform: translateY(-2px);
          background: #e6e6ff;
        }
        
        .renewal-value {
          font-size: 32px;
          font-weight: bold;
          color: #010139;
        }
        
        .renewal-label {
          font-size: 14px;
          color: #666;
          margin-top: 4px;
        }
        
        /* Morosidad */
        .morosidad-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          background: #fff5f5;
          border: 1px solid #ffdddd;
          border-radius: 12px;
        }
        
        .morosidad-label {
          font-size: 16px;
          font-weight: 500;
          color: #666;
        }
        
        .morosidad-value {
          font-size: 24px;
          font-weight: bold;
          color: #d32f2f;
        }
        
        /* Check cards */
        .check-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .check-card {
          display: flex;
          flex-direction: column;
          padding: 20px;
          background: #f6f6ff;
          border-radius: 12px;
        }
        
        .check-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }
        
        .check-value {
          font-size: 20px;
          font-weight: bold;
          color: #010139;
        }
        
        @media (max-width: 768px) {
          .status-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .renewal-cards {
            grid-template-columns: 1fr;
          }
          
          .check-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MasterDashboard;
