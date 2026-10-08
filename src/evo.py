"""Эволюционное сглаживание признаков (идея AFFECT, Xu–Kose–Hero 2014): X~_t = a_t X~_{t-1} + (1-a_t) X_t,
a_t = sum(sigma^2) / sum((X~_{t-1}-X_t)^2), ограничено [0, a_max]. sigma^2 — шум измерения, оценивается по вторым разностям ряда."""
import numpy as np
def noise_var(F):
    d2=F[:,2:]-2*F[:,1:-1]+F[:,:-2]
    return np.nanvar(d2,axis=(0,1))/6.0      # var(second diff) = 6 sigma^2 для белого шума
def smooth(F,a_max=0.7):
    N,T,C=F.shape; s2=noise_var(F); out=F.copy(); alphas=[0.0]
    for t in range(1,T):
        num=s2.sum()*N; den=np.nansum((out[:,t-1]-F[:,t])**2)
        a=float(np.clip(num/den,0,a_max)); alphas.append(a)
        out[:,t]=a*out[:,t-1]+(1-a)*F[:,t]
    return out,np.array(alphas)
