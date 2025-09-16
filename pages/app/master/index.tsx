// /pages/app/master/index.tsx
import React, { useEffect, useState } from 'react';
import Bars from '../../../components/dash/Bars';
import MiniCalendar from '../../../components/dash/MiniCalendar';
import { apiGet } from '../../../lib/api';

export default function MasterDashboard(){
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(()=> {
    (async()=>{
      try{
        const res = await apiGet('/api/dashboard/master');
        setData(res);
      }catch(e:any){
        if (String(e.message).includes('401')) location.href = '/app/auth/login';
        else setErr(String(e.message || 'error'));
      }
    })();
  },[]);

  if (err) return <div style={{padding:16,color:'#b00'}}>Error: {err}</div>;
  if (!data) return <div style={{padding:16}}>Cargando...</div>;

  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const series = [{ label:'Total', data: (data.production ?? []).map((r:any)=>r.total ?? 0) }];

  return (
    <div style={{background:'#e6eee6', minHeight:'100vh', padding:'20px'}}>
      <h1 style={{color:'#2b2b2b'}}>Bienvenido de vuelta (Master)</h1>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, margin:'16px 0'}}>
        <KpiCard title="Acumulado PMA" value={`B/. ${Number(data.pmaYearTotal).toFixed(2)}`} onClick={()=>location.href='/app/produccion'} />
        <KpiCard title="Comisión Anual (Oficina)" value={`B/. ${Number(data.commissionsYearOffice).toFixed(2)}`} onClick={()=>location.href='/app/comisiones'} />
        <KpiCard title="Pendientes de identificar" value={Number(data.pendingIdentify || 0)} onClick={()=>location.href='/app/pendingItems'} />
      </div>

      <div style={{background:'#fff', borderRadius:12, boxShadow:'0 6px 16px rgba(0,0,0,.12)', padding:12}}>
        <h2>Producción mensual (Total)</h2>
        <Bars labels={months} series={series} />
      </div>

      <MiniCalendar events={data.calendar} />
    </div>
  );
}

function KpiCard({ title, value, onClick }:{ title:string; value:string|number; onClick?:()=>void }){
  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <style jsx>{`
        .card{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:16px;cursor:pointer;}
        .kpi-title{color:#777;font-weight:700}
        .kpi-value{color:#88aa19;font-weight:700;font-size:24px;margin-top:6px}
        .card:focus{outline:2px solid #88aa19}
      `}</style>
    </div>
  );
}

