import sys,time,json; sys.path.insert(0,'/home/claude/work')
import numpy as np, pandas as pd, scipy.sparse as sp
from scipy.optimize import linear_sum_assignment
from sklearn.metrics import adjusted_rand_score as ARI
from src.networks import *; from src.clustering import fit; from src.icvi import compute_all; from src.evo import smooth
K=7; SEED=0
z=np.load('out/cube.npz',allow_pickle=True); F=z['F']; months=list(z['months']); ids=z['ids']; tot=z['tot']
nobs=(~np.isnan(tot)).sum(1); core=np.where(nobs==24)[0]; part=np.where(nobs<24)[0]
Fc=F[core]; Dg=np.load('out/D_highway.npy')[np.ix_(core,core)].astype(float)
Fe,al=smooth(Fc)
def align(lab,ref,k):
    C=np.zeros((k,k)); 
    for a,b in zip(lab,ref): C[a,b]+=1
    r,c=linear_sum_assignment(-C); m=dict(zip(r,c)); return np.array([m[x] for x in lab]),m
labs=np.zeros((len(core),24),int); icvi=[]; Xs=[]; cents=[]; t0=time.time()
for t in range(24):
    nets,X=build_all(Fe,Dg,t,w=12); W=nets['multi']; lab=fit('sgc',X,W,K,seed=SEED)
    labs[:,t]=lab; Xs.append(X.astype(np.float32)); r=compute_all(X,W,lab); r['month']=months[t]; icvi.append(r)
    if t==23: sp.save_npz('out/W_final.npz',W); sp.save_npz('out/W_cos_final.npz',nets['cos'])
    print(t,months[t],np.bincount(lab),round(r['SW'],3),round(r['ANUI'],3),round(time.time()-t0),flush=True)
# выравнивание: каждый месяц сопоставляется напрямую с якорем (последний месяц) по расстоянию между центроидами
# (цепочечное выравнивание накапливало ошибку и «сдвигало» смысл типов)
cent=np.array([[Xs[t][labs[:,t]==k].mean(0) for k in range(K)] for t in range(24)])
al_labs=labs.copy()
for t in range(24):
    D=((cent[t][:,None,:]-cent[23][None])**2).sum(-1)**.5; r,c=linear_sum_assignment(D); m=dict(zip(r,c)); al_labs[:,t]=[m[x] for x in labs[:,t]]
# упорядочим типы по среднему уровню трат в последнем месяце (убывание) -> 0..K-1
lv=np.array([Fc[al_labs[:,23]==k,23,6].mean() for k in range(K)]); order=np.argsort(-lv); inv=np.empty(K,int); inv[order]=np.arange(K)
al_labs=inv[al_labs]
np.savez('out/labels_core.npz',labs=al_labs,core=core,ids_core=ids[core],Xs=np.stack(Xs),icvi=json.dumps(icvi),alphas=al)
print('done',round(time.time()-t0))
