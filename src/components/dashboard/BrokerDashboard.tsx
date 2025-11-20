import Link from "next/link";

import KpiCard from "./KpiCard";
import Donut from "./Donut";
import AgendaWidget from "./AgendaWidget";
import BarYtd from "./BarYtd";
import {
  getFortnightStatus,
  getNetCommissions,
  getAnnualNet,
  getRankingTop5,
  getContestProgress,
  getYtdComparison,
  getBrokerOfTheMonth,
} from "@/lib/dashboard/queries";
import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import type { ContestProgress, RankingEntry, RankingResult } from "@/lib/dashboard/types";

const ROLE = "broker" as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

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

  const [profileResult, fortnightStatus, netCommissions, annualNet, rankingData, contestData, ytdComparison, brokerOfTheMonth] =
    await Promise.all([
      profilePromise,
      getFortnightStatus(userId, ROLE),
      getNetCommissions(userId, ROLE),
      getAnnualNet(userId, ROLE),
      getRankingTop5(userId),
      getContestProgress(userId),
      getYtdComparison(userId, ROLE),
      getBrokerOfTheMonth(),
    ]);

  const profileName = profileResult.data?.full_name ?? "Corredor";
  const brokerId = profileResult.data?.broker_id ?? null;
  const ranking: RankingResult = rankingData;
  const contests: ContestProgress[] = contestData;

  const paidRange = fortnightStatus.paid?.fortnight
    ? `${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
        new Date(fortnightStatus.paid.fortnight.period_start),
      )} – ${new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "short" }).format(
        new Date(fortnightStatus.paid.fortnight.period_end),
      )}`
    : null;

  const rankingEntries: RankingEntry[] = [...ranking.entries]
    .sort((a, b) => a.position - b.position)
  const myEntry = ranking.entries.find((entry) => entry.total !== undefined);

  return (
    <div className="broker-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Bienvenido de vuelta, {profileName}</h1>
        <p className="dashboard-subtitle">Tu panel de control personal</p>
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
              value={ranking.currentPosition ?? "-"}
              subtitle={myEntry?.total ? `Tu producción: ${formatCurrency(myEntry.total)}` : "Mantente activo para subir en el ranking"}
            />
          </Link>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Top 5 Corredores {new Date().getFullYear()}</h2>
        <div className="ranking-list">
          {rankingEntries.length === 0 ? (
            <p className="empty-state">Aún no hay datos disponibles.</p>
          ) : (
            rankingEntries.map((entry) => {
              const getMedalEmoji = (position: number) => {
                if (position === 1) return '🥇';
                if (position === 2) return '🥈';
                if (position === 3) return '🥉';
                return null;
              };
              const medal = getMedalEmoji(entry.position);
              const isTopThree = entry.position <= 3;
              
              return (
                <Link href="/production" key={entry.brokerId} className="ranking-item-link">
                  <div className={`ranking-item ${isTopThree ? `ranking-top-${entry.position}` : ''}`}>
                    <div className="ranking-medal-container">
                      {medal ? (
                        <span className="ranking-medal ranking-medal-animated">{medal}</span>
                      ) : (
                        <span className="ranking-position">{entry.position}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="ranking-name">{entry.brokerName || "Sin nombre"}</span>
                    </div>
                    {isTopThree && <div className="ranking-glow"></div>}
                  </div>
                </Link>
              );
            })
          )}
        </div>
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
        <div className="view-more">
          <Link href="/production" className="link-primary">
            Ver ranking completo →
          </Link>
        </div>
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
        
        .ranking-list {
          background: #f6f6ff;
          border-radius: 12px;
          padding: 20px;
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
        
        .ranking-name {
          font-weight: 600;
          color: #010139;
          text-align: center;
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
        
        .broker-of-month-card {
          margin-top: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 50%, #FFD700 100%);
          border-radius: 16px;
          border: 3px solid #FFD700;
          box-shadow: 0 8px 24px rgba(255, 215, 0, 0.3);
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          overflow: hidden;
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
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        
        .broker-of-month-trophy {
          font-size: 48px;
          line-height: 1;
          animation: trophyBounce 1.5s ease-in-out infinite;
          filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.5));
          z-index: 1;
        }
        
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        .broker-of-month-content {
          flex: 1;
          z-index: 1;
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
          font-size: 20px;
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
          margin-top: 16px;
          text-align: right;
        }
        
        .link-primary {
          color: #8aaa19;
          font-weight: 600;
          text-decoration: none;
          font-size: 14px;
        }
        
        .link-primary:hover {
          color: #6f8815;
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
