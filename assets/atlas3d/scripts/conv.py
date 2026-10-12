import re, json, struct, sys, os, collections
SRC='/tmp/bp3d_dl/isa/isa_BP3D_4.0_obj_99/'
def load_obj(fid):
    V=[];N=[];F=[]
    for l in open(SRC+fid+'.obj',encoding='utf-8',errors='ignore'):
        if l.startswith('v '): V.append(tuple(map(float,l.split()[1:4])))
        elif l.startswith('vn '): N.append(tuple(map(float,l.split()[1:4])))
        elif l.startswith('f '):
            idx=[int(p.split('/')[0])-1 for p in l.split()[1:4]]
            F.append(idx)
    return V,N,F
parts=collections.OrderedDict()
for l in open('/tmp/bp3d_dl/isa_element_parts.txt',encoding='utf-8').read().splitlines()[1:]:
    c,n,f=l.split('\t'); parts.setdefault(n,[]).append(f)
def mean(name):
    xs=[];ys=[];zs=[]
    for f in parts[name]:
        V,N,F=load_obj(f)
        for v in V: xs.append(v[0]);ys.append(v[1]);zs.append(v[2])
    return sum(xs)/len(xs),sum(ys)/len(ys),sum(zs)/len(zs),len(xs)
for n in ['right pectoralis major','sternocostal part of right pectoralis major','right longissimus thoracis','right rectus femoris','left rectus femoris','right gluteus maximus','right brachialis','right soleus','right tibialis anterior']:
    if n in parts: print(n, [round(v,1) for v in mean(n)])
    else: print('missing',n)
