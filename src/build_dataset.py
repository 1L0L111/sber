import sys,json,time; sys.path.insert(0,'/home/claude/work')
import numpy as np, pandas as pd, scipy.sparse as sp, geopandas as gpd
from scipy.optimize import linear_sum_assignment
from src.clustering import fit
U='/mnt/user-data/uploads/'; K=7
z=np.load('out/cube.npz',allow_pickle=True); F=z['F']; months=[str(m) for m in z['months']]; ids=z['ids']; tot=z['tot']; comp=z['comp']
d=np.load('out/labels_core.npz',allow_pickle=True); L=d['labs']; core=d['core']; Xs=d['Xs']; icvi=json.loads(str(d['icvi'])); alphas=d['alphas']
nobs=(~np.isnan(tot)).sum(1); part=np.where(nobs<24)[0]; N=len(ids); T=24
sf=pd.read_parquet('out/static.parquet')
dic=pd.read_excel(U+'t_dict_municipal_districts.xlsx').drop_duplicates('territory_id',keep='last').set_index('territory_id')
# ---------- метки по всем МО ----------
lab=np.full((N,T),-1,int); lab[core]=L
from src.features import *
cent=np.stack([[Xs[t][L[:,t]==k].mean(0) for k in range(K)] for t in range(T)])        # [T,K,7]
Fe_mean=np.array([Xs[t].mean(0) for t in range(T)])
# параметры стандартизации ядра (из сглаженных признаков): Xs уже z-score; для частичных используем сырые F, стандартизованные по ядру
Fc=F[core]
for i in part:
    for t in range(T):
        if np.isnan(F[i,t]).any(): continue
        mu=np.nanmean(Fc[:,t],0); sd=np.nanstd(Fc[:,t],0)
        x=(F[i,t]-mu)/sd; lab[i,t]=int(np.argmin(((cent[t]-x)**2).sum(1)))
# ---------- уверенность (бутстрэп с шумом на последнем месяце) + второй по близости тип ----------
Wf=sp.load_npz('out/W_final.npz'); X=Xs[23].astype(float); rng=np.random.default_rng(1); runs=[]
def align_to(l,ref):
    C=np.zeros((K,K))
    for a,b in zip(l,ref): C[a,b]+=1
    r,c=linear_sum_assignment(-C); m=dict(zip(r,c)); return np.array([m[x] for x in l])
base=L[:,23]
for s in range(40):
    l=fit('sgc',X+rng.normal(0,0.2,X.shape),Wf,K,seed=s); runs.append(align_to(l,base))
runs=np.array(runs); conf_core=(runs==base[None]).mean(0)
dist=((X[:,None,:]-cent[23][None])**2).sum(-1); second=np.argsort(dist,1)[:,1]
conf=np.full(N,np.nan); conf[core]=conf_core; sec=np.full(N,-1); sec[core]=second
# ---------- траектории ----------
def mode(a): 
    a=a[a>=0]; 
    return (np.bincount(a,minlength=K).argmax(), np.bincount(a,minlength=K).max()/len(a)) if len(a) else (-1,0)
traj=[]; dom=np.full(N,-1); domshare=np.zeros(N); sw=np.zeros(N,int)
for i in range(N):
    l=lab[i]; m,s=mode(l); dom[i]=m; domshare[i]=s; v=l[l>=0]; sw[i]=int((np.diff(v)!=0).sum()) if len(v)>1 else 0
    a,sa=mode(l[6:12]); b,sb=mode(l[18:])
    if nobs[i]<12: c='partial'
    elif s>=0.85: c='stable'
    elif a!=b and sa>=0.65 and sb>=0.65: c='moved'
    else: c='border'
    traj.append(c)
traj=np.array(traj); print(pd.Series(traj).value_counts().to_dict())
# финальный тип МО: последний месяц, где есть метка; для ядра — Dec-2024
final=np.array([ (lab[i][lab[i]>=0][-1] if (lab[i]>=0).any() else -1) for i in range(N)])
# ---------- похожие территории ----------
Z=Xs[18:].mean(0); Z=Z/np.linalg.norm(Z,axis=1,keepdims=True); S=Z@Z.T; np.fill_diagonal(S,-9)
sim=np.argsort(-S,1)[:,:6]; cpos={int(c):p for p,c in enumerate(core)}
# ---------- гео-признаки ----------
Dh=np.load('out/D_highway.npy'); Dn=Dh.copy(); np.fill_diagonal(Dn,np.inf); iso=np.sort(Dn,1)[:,:5].mean(1)
conn=pd.read_parquet(U+'connection.parquet'); rail=set(conn[conn.type=='railway'].territory_id_x)|set(conn[conn.type=='railway'].territory_id_y)
ma=pd.read_parquet(U+'market_access.parquet').set_index('territory_id').market_access
# ---------- контекст Росстата по региону ----------
a=pd.read_parquet('rosstat.parquet'); a=a[a.object_level=='Регион']
def rs(code,year): 
    x=a[(a.indicator_code==code)&(a.year==year)]; return x.set_index('object_name').indicator_value.astype(float)
pop=rs('Y477010003',2023); ctx=pd.DataFrame({'unemp':rs('Y477170028',2024),'employ':rs('Y477170033',2024),'urban':rs('Y477010002',2023)/pop*100,
  'paid_svc_pc':rs('Y477080048',2024)*1e6/(pop*1e3)/12,'invest_pc':rs('Y477140023',2023),'housing_price':rs('Y477190015',2023),'housing_new':rs('Y477030007',2024)})
fix={'Тюменская область':'Тюменская область (без автономных округов)','Архангельская область':'Архангельская область (без автономного округа)'}
reg=dic.loc[ids,'region_name'].values; rkey=[fix.get(r,r) for r in reg]
C=ctx.reindex(rkey); C.index=ids; print('ctx coverage',C.notna().mean().round(2).to_dict())
# ---------- профили типов ----------
sfa=sf.loc[ids].copy(); sfa['ma']=ma.reindex(ids).values; sfa['iso']=iso; sfa['rail']=[int(i in rail) for i in ids]
sfa['otype']=dic.loc[ids,'municipal_district_type'].values; sfa['final']=final
prof=[]
cols=['total_rub','level_log','share_food','share_health','share_cater','share_transp','share_mkt','share_other','volatility','seasonality','mkt_growth_pp','nominal_growth_pct','ma','iso','rail']
for k in range(K):
    m=sfa[(sfa.final==k)]; r={c:float(np.nanmean(m[c])) for c in cols}; r['n']=int(len(m)); r['n_core']=int(((sfa.final==k)&(sfa.months_obs==24)).sum())
    r['otype']=m.otype.value_counts(normalize=True).round(3).to_dict()
    r['regions']=pd.Series(np.array(reg)[sfa.final.values==k]).value_counts().head(6).to_dict()
    cc=C[sfa.final.values==k].mean(); r['ctx']={c:float(cc[c]) for c in C.columns}
    tops=m.sort_values('total_rub',ascending=False)
    r['examples']=[dic.loc[i,'municipal_district_name_short']+' · '+dic.loc[i,'region_name'] for i in tops.index[:4]]
    prof.append(r)
russia={c:float(np.nanmean(sfa[c])) for c in cols}
# ---------- динамика ----------
cnt=np.array([[ (lab[:,t]==k).sum() for k in range(K)] for t in range(T)])
def modal_block(sl):
    out=np.full(N,-1)
    for i in range(N):
        v=lab[i,sl]; v=v[v>=0]
        if len(v): out[i]=np.bincount(v,minlength=K).argmax()
    return out
A=modal_block(slice(6,12)); B=modal_block(slice(18,24)); ok=(A>=0)&(B>=0)
trans=np.zeros((K,K),int)
for x,y in zip(A[ok],B[ok]): trans[x,y]+=1
mon_trans=np.zeros((K,K),int)
for i in core:
    for t in range(23): mon_trans[lab[i,t],lab[i,t+1]]+=1
# по регионам
regdist=pd.crosstab(np.array(reg),final)
regdist=regdist[[c for c in regdist.columns if c>=0]]
# ---------- динамика профилей типов (по финальному типу) ----------
tser=[]
for k in range(K):
    m=np.where(final==k)[0]
    rel=np.log(tot[m])-np.nanmedian(np.log(tot),0)
    tser.append(dict(level=[round(float(np.nanmean(rel[:,t])),4) for t in range(T)],
        mkt=[round(float(np.nanmean(comp[m,t,4]))*100,2) for t in range(T)],food=[round(float(np.nanmean(comp[m,t,0]))*100,2) for t in range(T)],
        cater=[round(float(np.nanmean(comp[m,t,2]))*100,2) for t in range(T)],transp=[round(float(np.nanmean(comp[m,t,3]))*100,2) for t in range(T)],
        tot=[round(float(np.nanmean(tot[m,t]))) for t in range(T)]))
rus=dict(mkt=[round(float(np.nanmean(comp[:,t,4]))*100,2) for t in range(T)],tot=[round(float(np.nanmean(tot[:,t]))) for t in range(T)])
# ---------- методы ----------
grid=pd.read_csv('out/grid.csv'); ks=pd.read_csv('out/kscan.csv'); ks['cfg']=ks.net+'/'+ks.method+'/'+ks.src
gm=grid.groupby(['net','method'])[['SW','CH','DBI','S_Dbw','Q','MQ','AVI','AVU','ANUI']].mean().reset_index()
gm['balance']=grid.assign(b=grid.minsize/(2016/grid.k)).groupby(['net','method']).b.mean().values
kk=ks.groupby(['cfg','k'])[['SW','CH','DBI','S_Dbw','Q','AVI','AVU','ANUI','ari_adj','ari_noise','minshare']].mean().reset_index()
# ---------- сборка ----------
rows=[]
for j,i in enumerate(ids):
    r=dic.loc[i]; s=sfa.iloc[j]
    rows.append(dict(id=int(i),n=r.municipal_district_name_short,r=r.region_name,ot=str(r.municipal_district_type),
        lat=round(float(r.municipal_district_center_lat),3),lon=round(float(r.municipal_district_center_lon),3),
        L=''.join('-' if v<0 else str(v) for v in lab[j]),f=int(final[j]),dom=int(dom[j]),ds=round(float(domshare[j]),2),sw=int(sw[j]),
        tr=str(traj[j]),cf=None if np.isnan(conf[j]) else round(float(conf[j]),2),sec=int(sec[j]),
        sim=[int(ids[core[x]]) for x in sim[cpos[j]]] if j in cpos else [],
        v=[round(float(s[c]),2) for c in ['total_rub','level_log','share_food','share_health','share_cater','share_transp','share_mkt','share_other','volatility','seasonality','mkt_growth_pp','nominal_growth_pct']],
        ma=None if np.isnan(s.ma) else round(float(s.ma),1),iso=round(float(s.iso)),rail=int(s.rail),mo=int(s.months_obs),
        ctx=[None if np.isnan(x) else round(float(x),1) for x in C.iloc[j].values],
        ser=[None if np.isnan(x) else int(round(x)) for x in tot[j]]))
out=dict(tser=tser,rus=rus,months=months,mo=rows,prof=prof,russia=russia,cnt=cnt.tolist(),trans=trans.tolist(),mon_trans=mon_trans.tolist(),
    ctxcols=list(C.columns),regdist={k:[int(x) for x in v] for k,v in regdist.iterrows()} if False else {k:[int(regdist.loc[k].get(c,0)) for c in range(K)] for k in regdist.index},
    icvi=icvi,alphas=[round(float(x),3) for x in alphas],grid=gm.round(4).to_dict('records'),kscan=kk.round(4).to_dict('records'),
    trajcnt=pd.Series(traj).value_counts().to_dict(),nsame=float((L[:,11]==L[:,23]).mean()),adj=float(np.mean([(L[:,t]==L[:,t+1]).mean() for t in range(23)])))
def clean(o):
    if isinstance(o,float): return None if (o!=o or o in (float('inf'),float('-inf'))) else o
    if isinstance(o,dict): return {k:clean(v) for k,v in o.items()}
    if isinstance(o,(list,tuple)): return [clean(v) for v in o]
    return o
json.dump(clean(out),open('out/site_data.json','w'),ensure_ascii=False,separators=(',',':'),allow_nan=False)
import os; print('json MB',os.path.getsize('out/site_data.json')/1e6)
print(pd.DataFrame(prof)[['n','n_core','total_rub','level_log','share_food','share_cater','share_mkt','volatility','seasonality']].round(2))
print('trans diag share',np.trace(trans)/trans.sum(), 'conf mean',np.nanmean(conf))
