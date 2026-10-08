import json
d=open('/home/claude/work/out/site_data.json').read(); g=open('/home/claude/work/out/geo.json').read()
css=open('style.css').read(); body=open('body.html').read(); js=open('app.js').read()
html=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Атлас трат: семь типов российских территорий</title>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;700&display=swap&subset=cyrillic" rel="stylesheet">
<style>{css}</style></head><body>{body}
<script type="application/json" id="data">{d}</script><script type="application/json" id="geo">{g}</script>
<script>{js}</script></body></html>'''
import os; os.makedirs('/mnt/user-data/outputs',exist_ok=True)
open('/mnt/user-data/outputs/atlas.html','w').write(html); print(len(html)/1e6,'MB')
