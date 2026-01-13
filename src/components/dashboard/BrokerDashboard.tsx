import Link from "next/link";

import KpiCard from "./KpiCard";
import Donut from "./Donut";
import AgendaWidget from "./AgendaWidget";
import BarYtd from "./BarYtd";
import ImportantDatesSection from "./ImportantDatesSection";
import {
  getFortnightStatus,
  getNetCommissions,
  getAnnualNet,
  getBrokerRanking,
  getContestProgress,
  getYtdComparison,
  getBrokerOfTheMonth,
} from "@/lib/dashboard/queries";
import { getImportantDates } from "@/lib/important-dates";
import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import type { ContestProgress, RankingEntry, RankingResult } from "@/lib/dashboard/types";

const ROLE = "broker" as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

// Función para formatear nombre: solo primer nombre, capitalizado
const formatFirstName = (fullName: string | null | undefined): string => {
  if (!fullName) return "Corredor";
  
  // Tomar solo la parte antes del primer espacio
  const firstName = fullName.trim().split(" ")[0];
  if (!firstName) return "Corredor";
  
  // Capitalizar: primera letra mayúscula, resto minúsculas
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

interface BrokerDashboardProps {
  userId: string;
}

const BrokerDashboard = async ({ userId }: BrokerDashboardProps) => {
  const supabase = await getSupabaseServer();
  const profilePromise = supabase
    .from("profiles")
    .select("full_name, broker_id")
    .eq("id", userId)
    .maybeSingle<Pick<Tables<"profiles">, "full_name" | "broker_id">>();

  const [profileResult, fortnightStatus, netCommissions, annualNet, brokerRanking, contestData, ytdComparison, brokerOfTheMonth, importantDates] =
    await Promise.all([
      profilePromise,
      getFortnightStatus(userId, ROLE),
      getNetCommissions(userId, ROLE),
      getAnnualNet(userId, ROLE),
      getBrokerRanking(),
      getContestProgress(userId),
      getYtdComparison(userId, ROLE),
      getBrokerOfTheMonth(),
      getImportantDates(),
    ]);

  const profileName = formatFirstName(profileResult.data?.full_name);
  const brokerId = profileResult.data?.broker_id ?? null;
  const contests: ContestProgress[] = contestData;

  // Obtener el rango de la última quincena pagada (puede ser de otro mes)
  let paidRange: string | null = null;
  
  if (fortnightStatus.paid?.fortnight) {
    // Hay una quincena pagada en el período reciente
    paidRange = `${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
      new Date(fortnightStatus.paid.fortnight.period_start),
    )} – ${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
      new Date(fortnightStatus.paid.fortnight.period_end),
    )}`;
  } else if (netCommissions.lastPaid > 0 && brokerId) {
    // No hay quincena pagada reciente, buscar la última en historial
    const lastFortnight = await supabase
      .from('fortnights')
      .select('period_start, period_end')
      .in('status', ['PAID', 'READY'])
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastFortnight.data) {
      paidRange = `${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
        new Date(lastFortnight.data.period_start),
      )} – ${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
        new Date(lastFortnight.data.period_end),
      )}`;
    }
  }

  // Find broker's position in ranking
  const myPosition = brokerRanking.findIndex(b => b.brokerId === brokerId) + 1;
  const myEntry = brokerRanking.find(b => b.brokerId === brokerId);

  return (
    <div className="broker-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">¡Hola {profileName}! 👋</h1>
        <p className="dashboard-subtitle">Nos alegra verte hoy. Aquí está tu resumen de actividad</p>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Resumen de KPIs</h2>
        <div className="kpi-grid">
          <Link href="/commissions" className="block">
            <KpiCard
              title="Comisiones netas"
              value={formatCurrency(netCommissions.lastPaid)}
              subtitle={paidRange ?? "Sin quincena pagada"}
            />
          </Link>

          <Link href="/production" className="block">
            <KpiCard
              title="Acumulado anual neto"
              value={formatCurrency(annualNet.value)}
              subtitle={`Año ${new Date().getFullYear()}`}
            />
          </Link>

          <Link href="/production" className="block">
            <KpiCard
              title="Posición ranking"
              value={myPosition > 0 ? myPosition : "-"}
              subtitle={myEntry?.total ? `Tu producción: ${formatCurrency(myEntry.total)}` : "Mantente activo para subir en el ranking"}
            />
          </Link>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Producción</h2>
        
        {/* Ranking de brokers y estadísticas */}
        <div className="ranking-stats-grid mt-6">
          {/* Top 5 Corredores */}
          <div className="ranking-section">
            <h3 className="subsection-title">Top 5 Corredores {new Date().getFullYear()}</h3>
            <div className="ranking-list">
            {brokerRanking.map((broker, index) => {
              const getMedalEmoji = (position: number) => {
                if (position === 1) return '🥇';
                if (position === 2) return '🥈';
                if (position === 3) return '🥉';
                return null;
              };
              const medal = getMedalEmoji(index + 1);
              const isTopThree = index < 3;
              
              return (
                <Link href="/production" key={broker.brokerId} className="ranking-item-link">
                  <div className={`ranking-item ${isTopThree ? `ranking-top-${index + 1}` : ''}`}>
                    <div className="ranking-medal-container">
                      {medal ? (
                        <span className="ranking-medal ranking-medal-animated">{medal}</span>
                      ) : (
                        <span className="ranking-position">{index + 1}</span>
                      )}
                    </div>
                    <div className="ranking-name-container">
                      <span className="ranking-name">{broker.brokerName}</span>
                    </div>
                    <div className="ranking-change">
                      {broker.positionChange === 'up' && broker.positionDiff ? (
                        <span className="change-up" title={`Subió ${broker.positionDiff} posición${broker.positionDiff > 1 ? 'es' : ''}`}>
                          ↑{broker.positionDiff}
                        </span>
                      ) : broker.positionChange === 'down' && broker.positionDiff ? (
                        <span className="change-down" title={`Bajó ${broker.positionDiff} posición${broker.positionDiff > 1 ? 'es' : ''}`}>
                          ↓{broker.positionDiff}
                        </span>
                      ) : broker.positionChange === 'new' ? (
                        <span className="change-new" title="Nuevo en el ranking">
                          NUEVO
                        </span>
                      ) : (
                        <span className="change-same" title="Mantuvo su posición">–</span>
                      )}
                    </div>
                    {isTopThree && <div className="ranking-glow"></div>}
                  </div>
                </Link>
              );
            })}
            </div>
            
            {/* Corredor del mes */}
            {brokerOfTheMonth && (
              <div className="broker-of-month-card">
                <div className="broker-of-month-trophy">🏆</div>
                <div className="broker-of-month-content">
                  <div className="broker-of-month-title">
                    Corredor del mes de {brokerOfTheMonth.monthName}
                  </div>
                  <div className="broker-of-month-name">
                    {brokerOfTheMonth.brokerName}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Fechas importantes del mes */}
          {importantDates && (
            <ImportantDatesSection 
              initialDates={importantDates} 
              isMaster={false} 
            />
          )}
        </div>
        
        {/* Link a producción */}
        <Link href="/production" className="view-more">Ver producción →</Link>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Concursos y Agenda</h2>
        <div className="contests-grid">
          {contests.map((contest) => (
            <Link href="/production" className="block h-full" key={contest.label}>
              <Donut
                label={contest.label}
                percent={contest.percent}
                target={contest.target}
                current={contest.value}
                baseColor={contest.label.includes("ASSA") ? "#010139" : "#8aaa19"}
                tooltip={contest.tooltip}
                contestStatus={contest.contestStatus}
                quotaType={contest.quotaType}
                targetDouble={contest.targetDouble}
                enableDoubleGoal={contest.enableDoubleGoal}
                periodLabel={contest.periodLabel}
                remaining={contest.target - contest.value}
                doubleRemaining={contest.targetDouble ? contest.targetDouble - contest.value : undefined}
              />
            </Link>
          ))}
          <div className="h-full">
            <AgendaWidget userId={userId} brokerId={brokerId} />
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Producción Año en Curso</h2>
        <Link href="/production" className="block">
          <BarYtd current={ytdComparison.current} last={ytdComparison.previous} />
        </Link>
      </div>

      <style>{`
        .broker-dashboard {
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .dashboard-header {
          margin-bottom: 32px;
        }
        
        .dashboard-title {
          font-size: 28px;
          font-weight: 700;
          color: #010139;
          text-align: center;
          margin-bottom: 8px;
        }
        
        .dashboard-subtitle {
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        
        .dashboard-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 20px;
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
        
        .subsection-title {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 12px;
        }
        
        .ranking-section .subsection-title {
          text-align: center;
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        
        /* Ranking */
        .ranking-stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        
        @media (min-width: 1024px) {
          .ranking-stats-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        
        .ranking-section {
          background: #f6f6ff;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 600px;
        }
        
        
        .ranking-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-height: 0;
          justify-content: space-between;
        }
        
        .ranking-item-link {
          text-decoration: none;
          color: inherit;
          display: flex;
          flex: 1;
          transition: transform 0.2s;
        }
        
        .ranking-item-link:hover {
          transform: translateX(4px);
        }
        
        .ranking-item {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          padding: 14px 20px;
          background: white;
          border-radius: 8px;
          border: 2px solid transparent;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
          min-height: 60px;
        }
        
        .ranking-item-link:hover .ranking-item {
          border-color: #8aaa19;
          box-shadow: 0 2px 8px rgba(138, 170, 25, 0.15);
        }
        
        .ranking-medal-container {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-width: 40px;
          flex-shrink: 0;
        }
        
        .ranking-medal {
          font-size: 28px;
          line-height: 1;
        }
        
        .ranking-medal-animated {
          display: inline-block;
          animation: medalPulse 2s ease-in-out infinite;
        }
        
        @keyframes medalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .ranking-position {
          font-size: 20px;
          font-weight: bold;
          color: #010139;
          width: 30px;
          text-align: center;
        }
        
        .ranking-name-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        
        .ranking-name {
          font-weight: 600;
          color: #010139;
          text-align: left;
        }
        
        .ranking-change {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
          min-width: 60px;
        }
        
        .change-up {
          color: #22c55e;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        
        .change-down {
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        
        .change-same {
          color: #64748b;
          font-size: 18px;
        }
        
        .change-new {
          color: #8AAA19;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(138, 170, 25, 0.1);
          border: 1px solid #8AAA19;
        }
        
        .ranking-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 12px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .ranking-top-1 {
          position: relative;
          background: linear-gradient(135deg, #fff9e6 0%, #fffbf0 100%);
          border-left: 4px solid #FFD700;
          box-shadow: 0 2px 12px rgba(255, 215, 0, 0.15);
        }
        
        .ranking-top-1:hover .ranking-glow {
          opacity: 1;
          background: radial-gradient(circle at center, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
        }
        
        .ranking-top-2 {
          position: relative;
          background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
          border-left: 4px solid #C0C0C0;
          box-shadow: 0 2px 10px rgba(192, 192, 192, 0.15);
        }
        
        .ranking-top-2:hover .ranking-glow {
          opacity: 1;
          background: radial-gradient(circle at center, rgba(192, 192, 192, 0.1) 0%, transparent 70%);
        }
        
        .ranking-top-3 {
          position: relative;
          background: linear-gradient(135deg, #fff5f0 0%, #fffaf5 100%);
          border-left: 4px solid #CD7F32;
          box-shadow: 0 2px 10px rgba(205, 127, 50, 0.15);
        }
        
        .ranking-top-3:hover .ranking-glow {
          opacity: 1;
          background: radial-gradient(circle at center, rgba(205, 127, 50, 0.1) 0%, transparent 70%);
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        
        .broker-of-month-card {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          padding: 16px 20px;
          margin-top: 20px;
          background: linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 50%, #FFD700 100%);
          border: 3px solid #FFD700;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
          overflow: hidden;
          min-height: 80px;
          flex-shrink: 0;
        }
        
        .broker-of-month-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 70%
          );
          animation: shimmer 3s infinite;
        }
        
        .broker-of-month-trophy {
          font-size: 42px;
          line-height: 1;
          animation: trophyBounce 2s ease-in-out infinite;
          filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.5));
          z-index: 1;
          flex-shrink: 0;
        }
        
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        .broker-of-month-content {
          flex: 1;
          z-index: 1;
          text-align: left;
        }
        
        .broker-of-month-title {
          font-size: 13px;
          font-weight: 700;
          color: #010139;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .broker-of-month-name {
          font-size: 17px;
          font-weight: 800;
          color: #010139;
          text-shadow: 1px 1px 2px rgba(255, 215, 0, 0.3);
        }
        
        .empty-state {
          text-align: center;
          color: #5f6368;
          padding: 20px;
        }
        
        .view-more {
          display: block;
          text-align: right;
          margin-top: 24px;
          color: #8aaa19;
          font-weight: 600;
          text-decoration: none;
        }
        
        .view-more:hover {
          color: #6f8815;
        }
        
        .dates-section {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 600px;
        }
        
        .dates-card {
          background: #f6f6ff;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
          height: 100%;
          flex: 1;
        }
        
        .dates-card-title {
          font-size: 18px;
          font-weight: 700;
          color: #010139;
          margin: 0 0 16px 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #e0e0f0;
          text-align: center;
          flex-shrink: 0;
        }
        
        .date-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: white;
          border-radius: 8px;
          border-left: 3px solid #8aaa19;
          flex: 1;
          min-height: 56px;
        }
        
        .date-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .date-content {
          flex: 1;
        }
        
        .date-label {
          font-size: 13px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 2px;
        }
        
        .date-value {
          font-size: 14px;
          color: #8aaa19;
          font-weight: 600;
        }
        
        .news-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #fff9e6;
          border-radius: 8px;
          border-left: 3px solid #FFD700;
          margin-top: 8px;
          flex: 1.5;
          min-height: 80px;
        }
        
        .news-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .news-content {
          flex: 1;
        }
        
        .news-label {
          font-size: 14px;
          font-weight: 700;
          color: #010139;
          margin-bottom: 6px;
        }
        
        .news-text {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }
        
        .edit-dates-btn {
          margin-top: auto;
          padding: 12px 16px;
          background: #8aaa19;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        
        .edit-dates-btn:hover {
          background: #6d8814;
        }
        
        .contests-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          grid-auto-rows: 1fr;
        }
        
        .contests-grid > * {
          min-height: 380px;
          display: flex;
          flex-direction: column;
        }
        
        @media (max-width: 1024px) {
          .contests-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 768px) {
          .contests-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default BrokerDashboard;
