import Link from "next/link";

import KpiCard from "./KpiCard";
import Donut from "./Donut";
import MiniCalendar from "./MiniCalendar";
import BarYtd from "./BarYtd";
import {
  getFortnightStatus,
  getNetCommissions,
  getAnnualNet,
  getRankingTop5,
  getContestProgress,
  getMiniCalendar,
  getYtdComparison,
} from "@/lib/dashboard/queries";
import { getSupabaseServer, type Tables } from "@/lib/supabase/server";
import type { CalendarEvent, ContestProgress, RankingEntry, RankingResult } from "@/lib/dashboard/types";

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
    .select("full_name")
    .eq("id", userId)
    .maybeSingle<Pick<Tables<"profiles">, "full_name">>();

  const [profileResult, fortnightStatus, netCommissions, annualNet, rankingData, contestData, calendarData, ytdComparison] =
    await Promise.all([
      profilePromise,
      getFortnightStatus(userId, ROLE),
      getNetCommissions(userId, ROLE),
      getAnnualNet(userId, ROLE),
      getRankingTop5(userId),
      getContestProgress(userId),
      getMiniCalendar(userId),
      getYtdComparison(userId, ROLE),
    ]);

  const profileName = profileResult.data?.full_name ?? "Corredor";
  const ranking: RankingResult = rankingData;
  const contests: ContestProgress[] = contestData;
  const calendarEvents: CalendarEvent[] = calendarData;

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

          <Link href="/produccion" className="block">
            <KpiCard
              title="Acumulado anual neto"
              value={formatCurrency(annualNet.value)}
              subtitle={`Año ${new Date().getFullYear()}`}
            />
          </Link>

          <Link href="/produccion" className="block">
            <KpiCard
              title="Posición ranking"
              value={ranking.currentPosition ?? "-"}
              subtitle={myEntry?.total ? `Tu producción: ${formatCurrency(myEntry.total)}` : "Mantente activo para subir en el ranking"}
            />
          </Link>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Top 5 corredores</h2>
        <div className="ranking-list">
          {rankingEntries.length === 0 ? (
            <p className="empty-state">Aún no hay datos disponibles.</p>
          ) : (
            rankingEntries.map((entry) => (
              <div key={entry.brokerId} className="ranking-item">
                <span className="ranking-name">
                  {entry.position}. {entry.brokerName || "Sin nombre"}
                </span>
                <span className="ranking-value">
                  {entry.total !== undefined ? formatCurrency(entry.total) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="view-more">
          <Link href="/produccion" className="link-primary">
            Ver producción completa →
          </Link>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Concursos y Agenda</h2>
        <div className="contests-grid">
          {contests.map((contest) => (
            <Link href="/produccion" className="block" key={contest.label}>
              <Donut
                label={contest.label}
                percent={contest.percent}
                value={`Meta ${formatCurrency(contest.target)}`}
                baseColor={contest.label.includes("ASSA") ? "#010139" : "#8aaa19"}
                tooltip={contest.tooltip}
              />
            </Link>
          ))}
          <Link href="/agenda" className="block">
            <MiniCalendar events={calendarEvents} />
          </Link>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Producción YTD</h2>
        <Link href="/produccion" className="block">
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
        
        .ranking-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f6f6ff;
          border-radius: 12px;
        }
        
        .ranking-name {
          font-weight: 600;
          color: #010139;
        }
        
        .ranking-value {
          color: #8a8a8a;
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
        }
        
        .contests-grid > * {
          min-height: 280px;
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
