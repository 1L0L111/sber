"""Построение сетей МО. Все функции возвращают разреженную симметричную матрицу весов W (N×N)."""
import numpy as np, scipy.sparse as sp, pandas as pd
from numba import njit, prange

def knn_sym(S, k, mutual=False):
    """S — плотная матрица сходства. kNN-граф, симметризация max (или min при mutual)."""
    N=S.shape[0]; S=S.copy(); np.fill_diagonal(S,-np.inf)
    idx=np.argpartition(-S,k,axis=1)[:,:k]
    r=np.repeat(np.arange(N),k); c=idx.ravel(); v=np.maximum(S[r,c],0)
    A=sp.csr_matrix((v,(r,c)),shape=(N,N))
    return (A.minimum(A.T) if mutual else A.maximum(A.T)).tocsr()

def cosine_sim(X):
    Xn=X-X.mean(0); Xn=Xn/np.linalg.norm(Xn,axis=1,keepdims=True).clip(1e-9)
    return Xn@Xn.T

def rbf_sim(X,sigma=None):
    sq=(X**2).sum(1); D=np.maximum(sq[:,None]+sq[None]-2*X@X.T,0)
    if sigma is None: sigma=np.sqrt(np.median(D[D>0]))
    return np.exp(-D/(2*sigma**2))

def corr_sim(R):
    """R[N,T] — ряды (NaN допустимы -> заполняем средним). Корреляция Пирсона."""
    R=np.where(np.isnan(R),np.nanmean(R,1,keepdims=True),R)
    return cosine_sim(R)

@njit(parallel=True,cache=True)
def dtw_matrix(R,band):
    N,T=R.shape; D=np.zeros((N,N))
    for i in prange(N):
        for j in range(i+1,N):
            prev=np.full(T,1e18); cur=np.full(T,1e18)
            for a in range(T):
                for b in range(max(0,a-band),min(T,a+band+1)):
                    d=(R[i,a]-R[j,b])**2
                    if a==0 and b==0: best=0.0
                    else:
                        best=1e18
                        if a>0 and prev[b]<best: best=prev[b]
                        if b>0 and cur[b-1]<best: best=cur[b-1]
                        if a>0 and b>0 and prev[b-1]<best: best=prev[b-1]
                    cur[b]=d+best
                for b in range(T): prev[b]=cur[b]; cur[b]=1e18
            D[i,j]=np.sqrt(prev[T-1]); D[j,i]=D[i,j]
    return D

def geo_matrix(ids, conn, kind='highway', fill=None):
    """Плотная матрица дорожных расстояний (км). Пары без связи -> fill (по умолчанию max*1.5)."""
    ix={t:k for k,t in enumerate(ids)}; N=len(ids)
    c=conn[conn.type==kind]; c=c[c.territory_id_x.isin(ix)&c.territory_id_y.isin(ix)]
    a=c.territory_id_x.map(ix).values; b=c.territory_id_y.map(ix).values
    D=np.full((N,N),np.nan); D[a,b]=c.distance.values; D[b,a]=c.distance.values
    np.fill_diagonal(D,0)
    if fill is None: fill=np.nanmax(D)*1.5
    return np.where(np.isnan(D),fill,D)

@njit(parallel=True,cache=True)
def dtw_matrix_mv(R,band):
    """DTW для многомерных рядов R[N,T,C], окно Сако–Чиба."""
    N,T,C=R.shape; D=np.zeros((N,N))
    for i in prange(N):
        for j in range(i+1,N):
            prev=np.full(T,1e18); cur=np.full(T,1e18)
            for a in range(T):
                for b in range(max(0,a-band),min(T,a+band+1)):
                    d=0.0
                    for c in range(C): d+=(R[i,a,c]-R[j,b,c])**2
                    if a==0 and b==0: best=0.0
                    else:
                        best=1e18
                        if a>0 and prev[b]<best: best=prev[b]
                        if b>0 and cur[b-1]<best: best=cur[b-1]
                        if a>0 and b>0 and prev[b-1]<best: best=prev[b-1]
                    cur[b]=d+best
                for b in range(T): prev[b]=cur[b]; cur[b]=1e18
            D[i,j]=np.sqrt(prev[T-1]); D[j,i]=D[i,j]
    return D

def zs(X): return (X-X.mean(0))/X.std(0).clip(1e-9)

def window(F,t,w=12):
    return F[:,max(0,t-w+1):t+1,:]

def build_all(F,Dgeo,t,k=15,w=12,band=2):
    """Семейство сетей для месяца t (F — [N,T,C], без NaN). Возвращает {имя: W} и матрицы сходства."""
    X=zs(F[:,t]); Sc=cosine_sim(X)
    Wn=window(F,t,w); N,T,C=Wn.shape
    flat=zs(Wn.reshape(N,-1)); Sr=cosine_sim(flat)
    Dd=dtw_matrix_mv(np.ascontiguousarray(zs(Wn.reshape(N*T,C)).reshape(N,T,C)),band)
    Sd=np.exp(-Dd/np.median(Dd[Dd>0]))
    Sg=np.exp(-Dgeo/np.median(Dgeo))                       # гео-ядро
    rbf=rbf_sim(X)
    def rk(S):  # ранговая нормировка строк -> [0,1]
        r=np.empty(S.shape,dtype=np.float32)
        o=np.argsort(S,axis=1); n=S.shape[1]
        np.put_along_axis(r,o,np.broadcast_to(np.arange(n,dtype=np.float32),S.shape),axis=1)
        return r/(n-1)
    S_multi=(rk(Sc)+rk(Sr)+rk(Sd))/3
    S_multi=(S_multi+S_multi.T)/2
    nets={'cos':knn_sym(Sc,k),'rbf':knn_sym(rbf,k),'corr':knn_sym(Sr,k),'dtw':knn_sym(Sd,k),
          'road':knn_sym(Sg,k),'hybrid':knn_sym(np.clip(Sc,0,None)*np.exp(-Dgeo/500),k),'multi':knn_sym(S_multi,k)}
    return nets,X
