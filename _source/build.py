import re,shutil,os
os.chdir('/home/claude')
src=open('ama-site.html',encoding='utf-8').read()
imgs=sorted(set(re.findall(r'[\w-]+\.jpg',src)))
for i in imgs: shutil.copy('site/'+i,'ama-company-site/'+i)
head='<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="description" content="إكسسوارات المطابخ وغرف النوم وبديل الحجر في نابلس، مع توصيل لكل مدن الضفة والقدس والداخل.">\n<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
i=src.index('</style>')+len('</style>')
open('ama-company-site/index.html','w',encoding='utf-8').write(head+src[:i]+'\n</head>\n<body>\n'+src[i:]+'\n</body>\n</html>\n')
print('built',len(imgs),'images')

# catalog seed for the dashboard: the built-in products with stable ids.
# Product links (/p/<id>/) and their WhatsApp previews are served by functions/p from this data or from the dashboard's saved copy.
import json,subprocess
a=src.index('let CATS=['); b=src.index('const saleNow')
js=src[a:b]+'\nprocess.stdout.write(JSON.stringify({cats:CATS,products:P.map(p=>({id:slug(p),...p})),settings:{showPrices:SHOW_PRICES,sale:SALE}}));'
data=json.loads(subprocess.run(['node','-e',js],capture_output=True,text=True,check=True).stdout)
os.makedirs('ama-company-site/data',exist_ok=True)
json.dump(data,open('ama-company-site/data/seed.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
shutil.rmtree('ama-company-site/p',ignore_errors=True)
print('seed',len(data['products']),'products')

shutil.copy('ama-site.html','ama-company-site/_source/ama-site.html')
shutil.copy('tools/build.py','ama-company-site/_source/build.py')
