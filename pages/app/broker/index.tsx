import Head from 'next/head';
import React from 'react';

export default function BrokerDashboard() {
  return (
    <>
      <Head><title>Líderes en Seguros | Dashboard Broker</title></Head>
      <div className="wrap">
        <header className="bar">
          <button className="hamb">☰</button>
          <img src="/logo.svg" alt="LISSA" className="logo" />
          <div className="icons">
            <span className="ico">💬</span>
            <span className="ico">🔔</span>
            <span className="ico">▾</span>
          </div>
        </header>

        <main className="main">
          <h1 className="h1">Bienvenido devuelta <p className="broker name"></p></h1>

          <section className="kpis">
            <div className="kpi"><div className="kpiT">Última Quincena</div><div className="kpiV">B/. 757.90</div></div>
            <div className="kpi"><div className="kpiT">Morosidad +60 Días</div><div className="kpiV">B/. 264.80</div></div>
            <div className="kpi"><div className="kpiT">Pendientes de identificar</div><div className="kpiV green">20</div></div>
          </section>

          <section className="cards">
            <div className="card donut">Convivio LISSA</div>
            <div className="card donut">Concurso ASSA</div>
            <div className="card cal">Calendario</div>
          </section>

          <section className="big">
            <div className="card bigCard">
              <h2 className="bigTitle">Acumulado Anual PMA <span className="dots"><b>2024</b> • <b className="olive">2025</b></span></h2>
              <div className="chart">[Gráfica de barras aquí]</div>
            </div>
          </section>
        </main>

        <footer className="footBar">
          <div className="foot">
            <div>Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá Licencia PJ750</div>
            <div>Desarrollado por Líderes en Seguros | Todos los derechos reservados</div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .wrap{min-height:100vh;background:#e6e6e6;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column}
        .bar{height:64px;background:#fff;display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:12px;padding:0 16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
        .hamb{background:#fff;border:0;font-size:22px;cursor:pointer}
        .logo{height:36px;width:auto}
        .icons{display:flex;gap:14px;align-items:center}
        .ico{font-size:18px}
        .main{max-width:1200px;width:100%;margin:0 auto;padding:16px}
        .h1{color:#0b1039;margin:16px 0 20px;font-size:28px}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .kpi{background:#fff;border-radius:14px;box-shadow:0 12px 22px rgba(0,0,0,.10);padding:16px;text-align:center}
        .kpiT{color:#666;font-weight:700}
        .kpiV{margin-top:6px;font-weight:800;color:#1a1a1a}
        .kpiV.green{color:#8AAA19}
        .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}
        .card{background:#fff;border-radius:14px;box-shadow:0 12px 22px rgba(0,0,0,.12);min-height:220px;display:grid;place-items:center;color:#555}
        .big{margin:18px 0 32px}
        .bigCard{padding:12px 16px 24px}
        .bigTitle{margin:6px 0 12px;text-align:center}
        .dots{margin-left:10px}
        .olive{color:#8AAA19}
        .chart{height:340px;display:grid;place-items:center;color:#999}
        .footBar{background:#010139;padding:14px 0;margin-top:auto}
        .foot{max-width:1200px;margin:0 auto;color:#cfd3de;text-align:center;font-size:11px;line-height:1.3}
        @media (max-width:920px){ .kpis,.cards{grid-template-columns:1fr} .chart{height:260px} }
      `}</style>
    </>
  );
}

