"""Внутренние индексы качества (ICVI). Признаковые: SW, CH, DBI, S_Dbw. Сетевые: MQ, Q (модулярность), AVI, AVU, ANUI.
Формулировки AVI/AVU/ANUI — операциональные (см. methodology): изолируемость = 1 - доля веса, уходящего из кластера;
унифицируемость = средняя внутренняя плотность связей кластера, нормированная на максимальный вес."""
import numpy as np, scipy.sparse as sp
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

def s_dbw(X,lab):
    ks=np.unique(lab); K=len(ks)
    if K<2: return np.nan
    cen=np.stack([X[lab==k].mean(0) for k in ks]); sig=np.stack([X[lab==k].var(0) for k in ks])
    scat=np.mean([np.linalg.norm(sig[i]) for i in range(K)])/np.linalg.norm(X.var(0))
    stdev=np.sqrt(np.sum([np.linalg.norm(s) for s in sig]))/K
    def dens(pts,u): return np.sum(np.linalg.norm(pts-u,axis=1)<=stdev)
    tot=0.0
    for i in range(K):
        Xi=X[lab==ks[i]]
        for j in range(K):
            if i==j: continue
            Xij=np.vstack([Xi,X[lab==ks[j]]]); u=(cen[i]+cen[j])/2
            di=dens(Xij,cen[i]); dj=dens(Xij,cen[j]); d=max(di,dj)
            tot+= dens(Xij,u)/d if d>0 else 0
    return scat+tot/(K*(K-1))

def graph_indices(W,lab):
    W=sp.csr_matrix(W); N=W.shape[0]; ks=np.unique(lab); K=len(ks)
    deg=np.asarray(W.sum(1)).ravel(); m2=W.sum()                 # 2m
    Z=sp.csr_matrix((np.ones(N),(np.arange(N),np.searchsorted(ks,lab))),shape=(N,K))
    B=(Z.T@W@Z).toarray()                                          # межкластерные веса
    intra=np.diag(B); vol=B.sum(1); cut=vol-intra
    Q=float(np.sum(intra/m2-(vol/m2)**2))
    MQ=float(np.sum(np.where(intra+cut>0,intra/(intra+cut/2+1e-12)*0+ (2*intra)/(2*intra+cut+1e-12),0)))/K  # Mancoridis, нормирован на K
    iso=1-cut/np.maximum(vol,1e-12)                                # изолируемость кластера
    sizes=np.asarray(Z.sum(0)).ravel(); wmax=W.data.max()
    uni=intra/np.maximum(sizes*(sizes-1),1)/wmax                   # плотность
    uni=uni/ (uni+ (m2/ (N*(N-1)))/wmax )                           # нормировка к глобальной плотности -> (0,1)
    AVI=float(iso.mean()); AVU=float(uni.mean()); ANUI=float(2*AVI*AVU/(AVI+AVU+1e-12))
    return dict(Q=Q,MQ=MQ,AVI=AVI,AVU=AVU,ANUI=ANUI)

def compute_all(X,W,lab,fast=False):
    r={}
    r['SW']=silhouette_score(X,lab,sample_size=min(len(X),1500),random_state=0)
    r['CH']=calinski_harabasz_score(X,lab); r['DBI']=davies_bouldin_score(X,lab)
    r['S_Dbw']=np.nan if fast else s_dbw(X,lab)
    r.update(graph_indices(W,lab)); return r
