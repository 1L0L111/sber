import sys,time,itertools; sys.path.insert(0,'/home/claude/work')
import numpy as np, pandas as pd
from src.networks import *; from src.clustering import fit; from src.icvi import compute_all
z=np.load('out/cube.npz',allow_pickle=True); F=z['F']; months=list(z['months']); ids=z['ids']
core=np.where(np.sum(~np.isnan(z['tot']),1)==24)[0]; Fc=F[core]
Dg=np.load('out/D_highway.npy')[np.ix_(core,core)].astype(float)
rows=[]; t0=time.time()
for t in [11,17,23]:
    nets,X=build_all(Fc,Dg,t); print('nets',months[t],round(time.time()-t0),flush=True)
    for nn,W in nets.items():
        for m in ['kmeans','ward','spectral','sgc','fused','leiden']:
            for k in [4,6,8,10]:
                lab=fit(m,X,W,k); r=compute_all(X,W,lab); r.update(month=months[t],net=nn,method=m,k=k,nclust=len(np.unique(lab)),minsize=np.bincount(lab).min()); rows.append(r)
        print(nn,round(time.time()-t0),flush=True)
        pd.DataFrame(rows).to_csv('out/grid.csv',index=False)
