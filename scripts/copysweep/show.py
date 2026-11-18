import json,sys,glob
for f in sorted(glob.glob(__import__('os').path.join(__import__('os').path.dirname(__file__),'results','*.json'))):
    j=json.load(open(f))
    if not isinstance(j,list): continue
    for s in j:
        w=s['worst']
        print(f"{f.split('/')[-1][:-5]:10} {s['copy'][:55]:55} | {s['engine'][:40]:40} checks={s['checks']} diff={s['differences']}", ('  e.g. '+w['inputs']+f" copy={w['copyValue']} engine={w['engineValue']}") if w else '')
