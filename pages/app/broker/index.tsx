// /pages/app/broker/index.tsx
import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Donut from '../../../components/dash/Donut';
import Bars from '../../../components/dash/Bars';
import MiniCalendar from '../../../components/dash/MiniCalendar';
import { apiGet } from '../../../lib/api';

export default function BrokerDashboard(){
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(()=> {
    (async()=>{
      try{
        const res = await apiGet('/api/dashboard/broker');
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
  const series = [{ label:'Producción', data: (data.production ?? []).map((r:any)=>r.total ?? 0) }];

  return (
    <AppLayout role="broker">
      <h1 style={{color:'#2b2b2b'}}>Bienvenido de vuelta (Broker)</h1>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginTop:16}}>
        <KpiCard title="Última quincena" value={`B/. ${Number(data.lastFortnightAmount ?? 0).toFixed(2)}`} />
        <KpiCard title="Morosidad +60" value={`B/. ${Number(data.morosidadOver60 ?? 0).toFixed(2)}`} />
        <KpiCard title="Pendientes de identificar" value={Number(data.pendingIdentify || 0)} />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:20}}>
        <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 6px 16px rgba(0,0,0,.12)', padding:12 }}>
          <Donut label="Convivio LISSA" current={data.convivio?.current ?? 0} goal={data.convivio?.goal ?? 0} split={data.convivio?.split ?? 0}/>
        </div>
        <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 6px 16px rgba(0,0,0,.12)', padding:12 }}>
          <Donut label="Concurso ASSA" current={data.assa?.current ?? 0} goal={data.assa?.goal ?? 0}/>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 6px 16px rgba(0,0,0,.12)', padding:12, marginTop:12 }}>
        <h2>Producción anual</h2>
        <Bars labels={months} series={series} />
      </div>

      <MiniCalendar events={data.calendar} />
    </AppLayout>
  );
}
