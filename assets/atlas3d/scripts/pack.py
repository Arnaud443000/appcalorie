import json,struct,math,collections
man=json.load(open('/tmp/bp3d_work/muscles.json'));buf=open('/tmp/bp3d_work/muscles.bin','rb').read()
def get(m):
    n=m['pLen']//12; P=[struct.unpack_from('<3f',buf,m['pOff']+12*i) for i in range(n)]
    k=m['iLen']//4; I=list(struct.unpack_from('<%dI'%k,buf,m['iOff'])); return P,I
# ---- back surface from existing muscles (right side mirrored by |x|) ----
bins=collections.defaultdict(lambda:9)
for m in man:
    if m['group'] in('chest','abs','traps','lats','lower_back','glutes','shoulders'):
        P,_=get(m)
        for x,y,z in P:
            if 0.9<y<1.42:
                key=(int(abs(x)/0.01),int(y/0.02)); bins[key]=min(bins[key],z)
def back_z(ax,y):
    best=None
    for dx in(-1,0,1):
        for dy in(-1,0,1):
            v=bins.get((int(ax/0.01)+dx,int(y/0.02)+dy))
            if v is not None and v<9: best=v if best is None else min(best,v)
    return best if best is not None else 0.0
# ---- loft in python ----
def vsub(a,b):return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def vadd(a,b):return (a[0]+b[0],a[1]+b[1],a[2]+b[2])
def vmul(a,k):return (a[0]*k,a[1]*k,a[2]*k)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm(a):
    l=math.sqrt(a[0]**2+a[1]**2+a[2]**2) or 1; return (a[0]/l,a[1]/l,a[2]/l)
def loft(A,B,C,F,wa,wb,da,db,peak,pr,N=28,M=20):
    k=math.log(.5)/math.log(peak);pos=[];idx=[]
    for i in range(N+1):
        t=i/N;mt=1-t
        P=vadd(vadd(vmul(A,mt*mt),vmul(C,2*mt*t)),vmul(B,t*t))
        Tg=norm(vadd(vmul(vsub(C,A),2*mt),vmul(vsub(B,C),2*t)))
        W=cross(F,Tg)
        if math.sqrt(sum(c*c for c in W))<1e-4: W=cross((0,1,0),Tg)
        W=norm(W);D=norm(cross(Tg,W))
        rr=.12+.88*max(0,math.sin(math.pi*t**k))**pr
        w=(wa+(wb-wa)*t)*rr;d=(da+(db-da)*t)*rr
        for j in range(M):
            ph=2*math.pi*j/M
            pos.append(vadd(P,vadd(vmul(W,math.cos(ph)*w),vmul(D,math.sin(ph)*d))))
    for i in range(N):
        for j in range(M):
            a=i*M+j;b=i*M+(j+1)%M;c=(i+1)*M+j;d=(i+1)*M+(j+1)%M
            idx+=[a,b,c,b,d,c]
    c0=len(pos);pos.append(A);c1=c0+1;pos.append(B)
    for j in range(M):
        j2=(j+1)%M; idx+=[c0,j2,j, c1,N*M+j,N*M+j2]
    return pos,idx
def lat(side):  # side=-1 right (x<0), +1 left
    s=side
    def pt(ax,y,off=-0.012): return (s*ax,y,back_z(ax,y)+off)
    A=pt(0.03,0.97); M_=pt(0.115,1.12); Bp=(s*0.168,1.265,0.045)
    C=vsub(vmul(M_,2),vmul(vadd(A,Bp),0.5))
    return loft(A,Bp,C,(0,0,-1),0.095,0.03,0.011,0.016,0.5,0.22)
extra=[]
for side,name in((-1,'right'),(1,'left')):
    P,I=lat(side); extra.append(dict(group='lats',name='Grand dorsal',side=name,P=P,I=I))
print('back_z samples',[round(back_z(0.115,y),3) for y in (0.97,1.05,1.12,1.2,1.27)])
# ---- pack all: int16 positions, uint16 indices ----
out=bytearray();mf=[]
items=[]
for m in man:
    P,I=get(m); items.append(dict(group=m['group'],name=m['name'],side=m['side'],P=P,I=I))
items=extra+items
for it in items:
    P=it['P'];I=it['I']
    mn=[min(p[a] for p in P) for a in range(3)];mx=[max(p[a] for p in P) for a in range(3)]
    sc=[(mx[a]-mn[a])/65535 or 1e-9 for a in range(3)]
    q=[]
    for p in P:
        for a in range(3): q.append(int(round((p[a]-mn[a])/sc[a]))-32768)
    pb=struct.pack('<%dh'%len(q),*q); ib=struct.pack('<%dH'%len(I),*I)
    ent=dict(group=it['group'],name=it['name'],side=it['side'],min=mn,scale=sc,pOff=len(out),pLen=len(pb))
    out+=pb; ent['iOff']=len(out);ent['iLen']=len(ib); out+=ib
    # pad to 4 bytes
    while len(out)%4: out+=b'\0'
    mf.append(ent)
open('/tmp/bp3d_work/site/muscles_q.bin','wb').write(out)
json.dump(mf,open('/tmp/bp3d_work/site/muscles_q.json','w'),ensure_ascii=False)
print('muscles',len(mf),'MB',len(out)/1e6)
