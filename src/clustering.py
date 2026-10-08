import numpy as np, scipy.sparse as sp, igraph as ig, leidenalg
from sklearn.cluster import KMeans, AgglomerativeClustering
from scipy.sparse.linalg import eigsh

def _norm_lap_embed(W,k):
    d=np.asarray(W.sum(1)).ravel(); d[d==0]=1; Dm=sp.diags(1/np.sqrt(d))
    L=Dm@W@Dm; vals,vecs=eigsh(L,k=k+1,which='LA'); V=vecs[:,np.argsort(-vals)[:k]]
    return V/np.linalg.norm(V,axis=1,keepdims=True).clip(1e-9)

def _km(X,k,seed=0): return KMeans(k,n_init=10,random_state=seed).fit_predict(X)

def fit(method,X,W,k,seed=0,alpha=0.6,hops=2):
    if method=='kmeans': return _km(X,k,seed)
    if method=='ward': return AgglomerativeClustering(k,linkage='ward').fit_predict(X)
    if method=='spectral': return _km(_norm_lap_embed(W,k),k,seed)
    if method=='sgc':   # сглаживание признаков по графу (низкочастотный фильтр) -> k-means
        d=np.asarray(W.sum(1)).ravel(); d[d==0]=1; P=sp.diags(1/d)@W; Y=X.copy()
        for _ in range(hops): Y=(1-alpha)*X+alpha*(P@Y)
        return _km(Y,k,seed)
    if method=='fused': # спектральное вложение графа ⊕ признаки (аналог KEFRiN: сумма двух источников)
        E=_norm_lap_embed(W,k); Z=(X-X.mean(0))/X.std(0).clip(1e-9)
        return _km(np.hstack([E*np.sqrt(Z.shape[1]/k)*1.0,Z]),k,seed)
    if method=='leiden': return _leiden_k(W,k,seed)
    raise ValueError(method)

def _leiden_k(W,k,seed):
    W=sp.triu(W,1).tocoo(); g=ig.Graph(n=W.shape[0],edges=list(zip(W.row,W.col)),directed=False); g.es['w']=W.data
    lo,hi=0.001,20.0; best=None
    for _ in range(14):
        mid=np.sqrt(lo*hi)
        p=leidenalg.find_partition(g,leidenalg.RBConfigurationVertexPartition,weights='w',resolution_parameter=mid,seed=seed,n_iterations=3)
        lab=np.array(p.membership); n=lab.max()+1
        if best is None or abs(n-k)<abs(best[0]-k): best=(n,lab)
        if n==k: break
        if n<k: lo=mid
        else: hi=mid
    n,lab=best
    # если число кластеров всё равно ≠ k, сливаем самые малые
    while lab.max()+1>k:
        sz=np.bincount(lab); s=np.argsort(sz)[0]
        Wc=sp.csr_matrix(W+W.T)
        Z=sp.csr_matrix((np.ones(len(lab)),(np.arange(len(lab)),lab))); B=(Z.T@Wc@Z).toarray(); B[s,s]=0
        t=np.argmax(B[s]); lab[lab==s]=t; _,lab=np.unique(lab,return_inverse=True)
    return lab
