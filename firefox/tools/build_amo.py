from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json, re

root=Path(__file__).resolve().parents[1]
app=root/'app'
output=root/'dist'/'mivu-firefox-AMO-upload-v0.1.0-security-fixed.zip'
manifest=json.loads((app/'manifest.json').read_text(encoding='utf-8'))
assert manifest['permissions']==[] and manifest['host_permissions']==[]
assert manifest['browser_specific_settings']['gecko']['data_collection_permissions']['required']==['none']
jsfiles=[p for p in app.rglob('*') if p.suffix in ('.js','.mjs')]
for p in jsfiles:
    src=p.read_text(encoding='utf-8')
    assert re.search(r'\.innerHTML\s*=|\.outerHTML\s*=',src) is None, p
output.parent.mkdir(exist_ok=True)
with ZipFile(output,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
    for path in sorted(app.rglob('*')):
        if path.is_file(): z.write(path,path.relative_to(app).as_posix())
with ZipFile(output) as z:
    assert z.testzip() is None
    assert 'manifest.json' in z.namelist()
    print(f'Package valid: {output} ({output.stat().st_size} bytes)')
