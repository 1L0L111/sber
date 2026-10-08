"""Панель признаков: помесячные CLR-доли трат, уровень, статические признаки."""
import numpy as np, pandas as pd
U='/mnt/user-data/uploads/'
CATS=['Продовольствие','Здоровье','Общественное питание','Транспорт','Маркетплейсы']
SHORT=['food','health','cater','transp','mkt','other']

def load_panel():
    c=pd.read_parquet(U+'consumption.parquet')
    p=c.pivot_table(index=['territory_id','date'],columns='category',values='value')
    p['other']=(p['Все категории']-p[CATS].sum(axis=1)).clip(lower=p['Все категории']*0.02)
    p=p.rename(columns=dict(zip(CATS,SHORT[:5]),**{'Все категории':'total'}))
    return p.reset_index()

def monthly_cube(p, months=None):
    """-> ids, months, comp[N,T,6] (доли), tot[N,T] (NaN где нет данных)"""
    months=sorted(p.date.unique()) if months is None else months
    ids=np.array(sorted(p.territory_id.unique()))
    ix={i:k for k,i in enumerate(ids)}; mx={m:k for k,m in enumerate(months)}
    comp=np.full((len(ids),len(months),6),np.nan); tot=np.full((len(ids),len(months)),np.nan)
    r=p.territory_id.map(ix).values; m=p.date.map(mx).values
    X=p[SHORT].values; comp[r,m]=X/X.sum(1,keepdims=True); tot[r,m]=p.total.values
    return ids,months,comp,tot

def clr(comp):
    l=np.log(comp); return l-l.mean(-1,keepdims=True)

def month_features(comp,tot):
    """F[N,T,7]: 6 CLR (центрированы по России в месяце) + лог-уровень (центрирован по месяцу).
    Центрирование по месяцу снимает общероссийскую сезонность и инфляцию."""
    z=clr(comp); z=z-np.nanmedian(z,axis=0,keepdims=True)
    lv=np.log(tot); lv=lv-np.nanmedian(lv,axis=0,keepdims=True)
    return np.concatenate([z,lv[...,None]],-1)

def static_features(ids,months,comp,tot):
    """Динамические характеристики поведения МО за 24 месяца (для интерпретации и признакового пространства)."""
    lt=np.log(tot); N,T=lt.shape
    nat=np.nanmedian(lt,0); dev=lt-nat                                 # отклонение от России
    f=pd.DataFrame(index=ids)
    f['level_log']=np.nanmean(dev,1)
    f['trend_pp_yr']=[np.polyfit(np.arange(T)[~np.isnan(r)],r[~np.isnan(r)],1)[0]*12*100 if (~np.isnan(r)).sum()>=6 else np.nan for r in dev]
    # сезонность: размах годового цикла относительно национального
    mon=np.array([int(m[5:7]) for m in months])
    seas=np.stack([np.nanmean(np.where(mon==k,dev-np.nanmean(dev,1,keepdims=True),np.nan),1) for k in range(1,13)],1)
    f['seasonality']=np.nanstd(seas,1)*100
    res=dev-np.nanmean(dev,1,keepdims=True)
    f['volatility']=np.nanstd(np.diff(res,axis=1),1)*100
    sh=comp
    for k,n in enumerate(SHORT): f['share_'+n]=np.nanmean(sh[:,:,k],1)*100
    y23=[i for i,m in enumerate(months) if m.startswith('2023')]; y24=[i for i,m in enumerate(months) if m.startswith('2024')]
    if y23 and y24:
        f['mkt_growth_pp']=(np.nanmean(sh[:,y24,4],1)-np.nanmean(sh[:,y23,4],1))*100
        f['nominal_growth_pct']=(np.nanmean(tot[:,y24],1)/np.nanmean(tot[:,y23],1)-1)*100
    f['months_obs']=np.sum(~np.isnan(tot),1)
    f['total_rub']=np.nanmean(tot,1)
    return f
