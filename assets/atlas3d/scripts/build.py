import json, struct, collections, base64, sys
sys.path.insert(0,'/tmp/bp3d_work')
SRC='/tmp/bp3d_dl/isa/isa_BP3D_4.0_obj_99/'
parts=collections.OrderedDict()
for l in open('/tmp/bp3d_dl/isa_element_parts.txt',encoding='utf-8').read().splitlines()[1:]:
    c,n,f=l.split('\t'); parts.setdefault(n,[]).append(f)
def load_obj(fid):
    V=[];F=[]
    for l in open(SRC+fid+'.obj',encoding='utf-8',errors='ignore'):
        if l.startswith('v '): V.append(tuple(map(float,l.split()[1:4])))
        elif l.startswith('f '): F.append([int(p.split('/')[0])-1 for p in l.split()[1:4]])
    return V,F
SPEC=[
 ('chest','Grand pectoral (faisceau sternocostal)','sternocostal part of {s} pectoralis major'),
 ('chest','Grand pectoral (faisceau claviculaire)','clavicular part of {s} pectoralis major'),
 ('chest','Grand pectoral (faisceau abdominal)','abdominal part of {s} pectoralis major'),
 ('shoulders','Deltoïde antérieur','clavicular part of {s} deltoid'),
 ('shoulders','Deltoïde moyen','acromial part of {s} deltoid'),
 ('shoulders','Deltoïde postérieur','spinal part of {s} deltoid'),
 ('biceps','Biceps brachial (chef long)','long head of {s} biceps brachii'),
 ('biceps','Biceps brachial (chef court)','short head of {s} biceps brachii'),
 ('biceps','Brachial','{s} brachialis'),
 ('triceps','Triceps (chef long)','long head of {s} triceps brachii'),
 ('triceps','Triceps (chef latéral)','lateral head of {s} triceps brachii'),
 ('triceps','Triceps (chef médial)','medial head of {s} triceps brachii'),
 ('forearms','Brachio-radial','{s} brachioradialis'),
 ('forearms','Long extenseur radial du carpe','{s} extensor carpi radialis longus'),
 ('forearms','Court extenseur radial du carpe','{s} extensor carpi radialis brevis'),
 ('forearms','Extenseur ulnaire du carpe','{s} extensor carpi ulnaris'),
 ('forearms','Extenseur des doigts','{s} extensor digitorum'),
 ('forearms','Fléchisseur radial du carpe','{s} flexor carpi radialis'),
 ('forearms','Fléchisseur ulnaire du carpe (chef huméral)','humeral head of {s} flexor carpi ulnaris'),
 ('forearms','Fléchisseur ulnaire du carpe (chef ulnaire)','ulnar head of {s} flexor carpi ulnaris'),
 ('forearms','Long palmaire','{s} palmaris longus'),
 ('forearms','Fléchisseur superficiel des doigts','{s} flexor digitorum superficialis'),
 ('forearms','Rond pronateur (chef huméral)','humeral head of {s} pronator teres'),
 ('forearms','Rond pronateur (chef ulnaire)','ulnar head of {s} pronator teres'),
 ('abs','Oblique externe','{s} external oblique'),
 ('abs','Dentelé antérieur','{s} serratus anterior'),
 ('traps','Trapèze supérieur','descending part of {s} trapezius'),
 ('traps','Trapèze moyen','transverse part of {s} trapezius'),
 ('traps','Trapèze inférieur','ascending part of {s} trapezius'),
 ('traps','Rhomboïde majeur','{s} rhomboid major'),
 ('traps','Rhomboïde mineur','{s} rhomboid minor'),
 ('lats','Grand rond','{s} teres major'),
 ('lats','Petit rond','{s} teres minor'),
 ('lats','Sous-épineux','{s} infraspinatus muscle'),
 ('lats','Sus-épineux','{s} supraspinatus'),
 ('lower_back','Iliocostal lombaire','{s} iliocostalis lumborum'),
 ('lower_back','Iliocostal thoracique','{s} iliocostalis thoracis'),
 ('lower_back','Longissimus thoracique','{s} longissimus thoracis'),
 ('lower_back','Épineux thoracique','{s} spinalis thoracis'),
 ('glutes','Grand fessier','{s} gluteus maximus'),
 ('glutes','Moyen fessier','{s} gluteus medius'),
 ('glutes','Petit fessier','{s} gluteus minimus'),
 ('glutes','Tenseur du fascia lata','{s} tensor fasciae latae'),
 ('quads','Droit fémoral','{s} rectus femoris'),
 ('quads','Vaste latéral','{s} vastus lateralis'),
 ('quads','Vaste médial','{s} vastus medialis'),
 ('quads','Vaste intermédiaire','{s} vastus intermedius'),
 ('quads','Sartorius','{s} sartorius'),
 ('hamstrings','Semi-tendineux','{s} semitendinosus'),
 ('hamstrings','Semi-membraneux','{s} semimembranosus'),
 ('hamstrings','Biceps fémoral (chef long)','long head of {s} biceps femoris'),
 ('hamstrings','Biceps fémoral (chef court)','short head of {s} biceps femoris'),
 ('adductors','Long adducteur','{s} adductor longus'),
 ('adductors','Court adducteur','{s} adductor brevis'),
 ('adductors','Grand adducteur','{s} adductor magnus'),
 ('adductors','Gracile','{s} gracilis'),
 ('adductors','Pectiné','{s} pectineus'),
 ('calves','Gastrocnémien médial','medial head of {s} gastrocnemius'),
 ('calves','Gastrocnémien latéral','lateral head of {s} gastrocnemius'),
 ('calves','Soléaire','{s} soleus'),
 ('calves','Tibial antérieur','{s} tibialis anterior'),
 ('calves','Long extenseur des orteils','{s} extensor digitorum longus'),
 ('calves','Long fibulaire','{s} fibularis longus'),
 ('neck','Sterno-cléido-mastoïdien','{s} sternocleidomastoid'),
]
out=[];missing=[];tv=tf=0
for g,fr,tpl in SPEC:
    for side in ('right','left'):
        nm=tpl.format(s=side)
        if nm not in parts: missing.append(nm); continue
        P=[];I=[]
        for fid in parts[nm]:
            V,F=load_obj(fid); off=len(P); P+=V; I+=[[a+off for a in f] for f in F]
        out.append(dict(group=g,name=fr,side=side,P=P,I=I,key=nm))
        tv+=len(P); tf+=len(I)
print('muscles',len(out),'verts',tv,'faces',tf,'missing',missing)
# pack: Float32 positions (meters, three coords) + Uint32 indices
bin_=bytearray(); man=[]
for m in out:
    pos=[]
    for (x,y,z) in m['P']: pos+= [x/1000.0, z/1000.0, -y/1000.0]
    idx=[i for f in m['I'] for i in f]
    pb=struct.pack('<%df'%len(pos),*pos); ib=struct.pack('<%dI'%len(idx),*idx)
    man.append(dict(group=m['group'],name=m['name'],side=m['side'],pOff=len(bin_),pLen=len(pb)))
    bin_+=pb; man[-1]['iOff']=len(bin_); man[-1]['iLen']=len(ib); bin_+=ib
open('/tmp/bp3d_work/muscles.bin','wb').write(bin_)
json.dump(man,open('/tmp/bp3d_work/muscles.json','w'),ensure_ascii=False)
print('bin MB',len(bin_)/1e6)
# bounds
xs=[];ys=[];zs=[]
for m in out:
    for (x,y,z) in m['P']: xs.append(x/1000);ys.append(z/1000);zs.append(-y/1000)
print('bounds x',min(xs),max(xs),'y',min(ys),max(ys),'z',min(zs),max(zs))
