import sys,time; sys.path.insert(0,'/home/claude/work')
import numpy as np, pandas as pd
from sklearn.metrics import adjusted_rand_score as ARI
from src.networks import *; from src.clustering import fit; from src.icvi import compute_all; from src.evo import smooth
z=np.load('out/cube.npz',allow_pickle=True); F=z['F']; months=list(z['months'])
core=np.where(np.sum(~np.isnan(z['tot']),1)==24)[0]; Fc=F[core]
Dg=np.load('out/D_highway.npy')[np.ix_(core,core)].astype(float)
Fe,al=smooth(Fc); print('alphas',np.round(al,2),flush=True)
np.save('out/alphas.npy',al)
rng=np.random.default_rng(0); rows=[]; cache={}
def nets_for(Fsrc,tag,t):
    key=(tag,t)
    if key not in cache:
        cache[key]=build_all(Fsrc,Dg,t,w=12)
    return cache[key]
configs=[('rbf','sgc','raw'),('multi','sgc','raw'),('multi','sgc','evo'),('multi','fused','evo'),('rbf','sgc','evo')]
pairs=[(10,11),(16,17),(22,23)]; t0=time.time()
for (a,b) in pairs:
    for net,meth,src in configs:
        Fs=Fc if src=='raw' else Fe
        Na,Xa=nets_for(Fs,src,a); Nb,Xb=nets_for(Fs,src,b); Wb=Nb[net]; Wa=Na[net]
        for k in range(3,13):
            la=fit(meth,Xa,Wa,k); lb=fit(meth,Xb,Wb,k)
            r=compute_all(Xb,Wb,lb); r.update(net=net,method=meth,src=src,k=k,t=b,ari_adj=ARI(la,lb))
            # устойчивость к шуму признаков
            Xn=Xb+rng.normal(0,0.15,Xb.shape); Wn=knn_sym(rbf_sim(Xn) if net=='rbf' else (cosine_sim(Xn)),15)
            ln=fit(meth,Xn,Wn if net=='rbf' else Wb,k); r['ari_noise']=ARI(lb,ln)
            r['minshare']=np.bincount(lb).min()/len(lb); rows.append(r)
        print(a,b,net,meth,src,round(time.time()-t0),flush=True)
        pd.DataFrame(rows).to_csv('out/kscan.csv',index=False)
