import re,shutil,os
os.chdir('/home/claude')
src=open('ama-site.html',encoding='utf-8').read()
imgs=sorted(set(re.findall(r'[\w-]+\.jpg',src)))
for i in imgs: shutil.copy('site/'+i,'ama-company-site/'+i)
head='<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="description" content="إكسسوارات المطابخ وغرف النوم وبديل الحجر في نابلس، مع توصيل لكل مدن الضفة والقدس والداخل.">\n<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
i=src.index('</style>')+len('</style>')
open('ama-company-site/index.html','w',encoding='utf-8').write(head+src[:i]+'\n</head>\n<body>\n'+src[i:]+'\n</body>\n</html>\n')
print('built',len(imgs),'images')

# product share pages: /p/<slug>/ carry the photo, name and price for WhatsApp previews
import json,subprocess,html as H
SITE='https://ama-company-ps.pages.dev'
a=src.index('const CATS=['); b=src.index('const WA=')
js=src[a:b]+'\nprocess.stdout.write(JSON.stringify({CATS,P}));'
data=json.loads(subprocess.run(['node','-e',js],capture_output=True,text=True,check=True).stdout)
show='const SHOW_PRICES=true' in src
shutil.rmtree('ama-company-site/p',ignore_errors=True)
import re as R
for p in data['P']:
    sl=R.sub(r'(-\d+)?\.jpg$','',R.sub(r'^p-','',p['imgs'][0]))
    v=p.get('variants'); pr=[x['price'] for x in v] if v else [p.get('price')]
    pr=[x for x in pr if isinstance(x,(int,float))]
    price=('' if not show or not pr else (f'السعر {pr[0]} ₪' if min(pr)==max(pr) else f'من {min(pr)} ₪ إلى {max(pr)} ₪'))
    cat=next(c['name'] for c in data['CATS'] if c['id']==p['cat'])
    desc=' · '.join(x for x in [price,cat]+p['specs'][:2] if x)
    img=(p.get('colors') or [{}])[0].get('imgs',[p['imgs'][0]])[0]
    t,d=H.escape(p['name']),H.escape(desc)
    page=f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} | ama.company.ps</title>
<meta name="description" content="{d}">
<meta property="og:type" content="product"><meta property="og:site_name" content="ama.company.ps">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}">
<meta property="og:image" content="{SITE}/{img}"><meta property="og:image:width" content="900"><meta property="og:image:height" content="900">
<meta property="og:url" content="{SITE}/p/{sl}/"><meta name="twitter:card" content="summary_large_image">
<style>body{{font-family:Tahoma,sans-serif;text-align:center;padding:40px 16px;background:#f4f5fb;color:#14204a}}img{{max-width:280px;border-radius:12px}}a{{color:#2f66c4}}</style>
<script>location.replace("/#p-{sl}")</script></head>
<body><img src="/{img}" alt="{t}"><h1>{t}</h1><p>{d}</p><p><a href="/#p-{sl}">افتح المنتج بالموقع</a></p></body></html>
'''
    os.makedirs(f'ama-company-site/p/{sl}',exist_ok=True)
    open(f'ama-company-site/p/{sl}/index.html','w',encoding='utf-8').write(page)
print('share pages',len(data['P']))
