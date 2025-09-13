import React, { useEffect, useState } from 'react';
import KpiCard from '../../../components/dash/KpiCard';
import Bars from '../../../components/dash/Bars';
import MiniCalendar from '../../../components/dash/MiniCalendar';

export default function MasterDashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/dashboard/master');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || r.statusText);
        setData(j.data);
      } catch (e:any) { setErr(String(e.message||e)); }
    })();
  }, []);

  if (err) return <div style={{padding:16,color:'#b00'}}>Error: {err}</div>;
  if (!data) return <div style={{padding:16}}>Cargando…</div>;

  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const series = [{ label: 'Total', data: data.production.map((r:any)=>r.total ?? 0) }];

  return (
    <div style={{background:'#e6e6e6',minHeight:'100vh',padding:'20px'}}>
      <h1 style={{color:'#2b2b2b'}}>Bienvenido devuelta (Master)</h1>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,margin:'16px 0'}}>
        <KpiCard title="Acumulado PMA" value={`B/. ${Number(data.pmaYearTotal).toFixed(2)}`} onClick={()=>location.href='/app/produccion'} />
        <KpiCard title="Comisión Anual (Oficina)" value={`B/. ${Number(data.commissionsYearOffice).toFixed(2)}`} onClick={()=>location.href='/app/comisiones'} />
        <KpiCard title="Pendientes de identificar" value={Number(data.pendingIdentify||0)} onClick={()=>location.href='/app/pendingItems'} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div>
          <div style={{background:'#fff',borderRadius:12,boxShadow:'0 6px 16px rgba(0,0,0,.12)',padding:12}}>
            <h2 style={{margin:'8px 0'}}>Producción mensual (Total)</h2>
            <Bars labels={months} series={series}/>
          </div>
        </div>
        <MiniCalendar events={data.calendar} />
      </div>

      {/* Botones de acción visibles (como pediste) */}
      <div style={{display:'flex',gap:12,marginTop:16}}>
        <button onClick={()=>location.href='/app/comisiones/importar'} style={btn}>Crear Comisión</button>
        <button onClick={()=>location.href='/app/morosidad/importar'} style={btn}>Imp Morosidad</button>
      </div>

      <style jsx>{`
        button:hover { transform: scale(1.02); }
      `}</style>
    </div>
  );
}

const btn: React.CSSProperties = {
  background:'#010139', color:'#fff', border:0, padding:'12px 16px',
  borderRadius:10, fontWeight:800, cursor:'pointer'
};
