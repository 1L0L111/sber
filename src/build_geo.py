import json, numpy as np, geopandas as gpd, pyproj
from shapely.ops import transform
from shapely.geometry import MultiPolygon, Polygon
U='/mnt/user-data/uploads/'
data=json.load(open('out/site_data.json')); idset={m['id'] for m in data['mo']}
g=gpd.read_file(U+'t_dict_municipal_districts_poly.gpkg'); g['territory_id']=g.territory_id.astype(int)
g=g[g.territory_id.isin(idset)].sort_values('year_to').drop_duplicates('territory_id',keep='last').copy()
print(len(g),'geoms for',len(idset))
proj=pyproj.Transformer.from_crs(4326,"+proj=aea +lat_1=50 +lat_2=66 +lat_0=0 +lon_0=100 +datum=WGS84 +units=km",always_xy=True).transform
paths={}; bbox=[1e9,1e9,-1e9,-1e9]; allb={}
for tid,geom in zip(g.territory_id,g.geometry):
    gg=transform(proj,geom)
    if not gg.is_valid: gg=gg.buffer(0)
    tol=float(np.clip(np.sqrt(gg.area)*0.012,0.12,6))
    s=gg.simplify(tol,preserve_topology=True)
    if s.is_empty: s=gg
    polys=list(s.geoms) if isinstance(s,MultiPolygon) else [s]
    d=''
    for p in polys:
        if p.is_empty or p.area<0.05: continue
        for ring in [p.exterior]:
            c=np.round(np.array(ring.coords)[:-1]*4).astype(int)
            if len(c)<3: continue
            c[:,1]=-c[:,1]
            dd=np.diff(c,axis=0)
            d+='M%d %dl'%(c[0,0],c[0,1])+' '.join('%d %d'%(a,b) for a,b in dd)+'z'
    paths[int(tid)]=d
    b=gg.bounds; allb[int(tid)]=[round(b[0]*4),round(-b[3]*4),round(b[2]*4),round(-b[1]*4)]
    bbox=[min(bbox[0],b[0]*4),min(bbox[1],-b[3]*4),max(bbox[2],b[2]*4),max(bbox[3],-b[1]*4)]
print('bbox',bbox)
# bbox регионов
reg={}
for m in data['mo']:
    b=allb.get(m['id']); 
    if not b: continue
    r=reg.setdefault(m['r'],[1e9,1e9,-1e9,-1e9]); reg[m['r']]=[min(r[0],b[0]),min(r[1],b[1]),max(r[2],b[2]),max(r[3],b[3])]
json.dump(dict(paths=paths,bbox=[round(x) for x in bbox],regbox=reg,mobox=allb),open('out/geo.json','w'),separators=(',',':'))
import os; print('geo MB',os.path.getsize('out/geo.json')/1e6, 'missing',len(idset-set(paths)))
