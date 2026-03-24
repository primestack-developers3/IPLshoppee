import re, pathlib
team_pages = ['csk.html','rcb.html','mi.html','kkr.html','rr.html','srh.html','gt.html','lsg.html','dc.html','pbks.html']
for page in team_pages:
    path = pathlib.Path('IPL teams') / page
    if not path.exists():
        print('Missing', path)
        continue
    raw = path.read_text(encoding='utf-8')
    if 'src="../../cart-manager.js"' not in raw:
        raw = re.sub(r'(<link\s+href="https://fonts\.googleapis\.com/css2\?[^>]*>)', r"\1\n  <script src=\"../../cart-manager.js\"></script>", raw, count=1)
    if 'id="header-container"' not in raw:
        raw = re.sub(r'(<body[^>]*>)', r"\1\n  <!-- Header Component -->\n  <div id=\"header-container\"></div>\n  <script>\n    fetch('../../components/header.html')\n      .then(r => r.text())\n      .then(html => { document.getElementById('header-container').innerHTML = html; initializeCart(); updateCartCount(); });\n  </script>\n\n  <!-- Cart Panel Component -->\n  <div id=\"cart-panel-container\"></div>\n  <script>\n    fetch('../../components/cart-panel.html').then(r => r.text()).then(html => document.getElementById('cart-panel-container').innerHTML = html);\n  </script>", raw, count=1)
    raw = re.sub(r"window\.addEventListener\('DOMContentLoaded'[\s\S]*?</script>\s*</body>", '</body>', raw, flags=re.IGNORECASE)
    if 'initializeCart()' not in raw:
        raw = re.sub(r'</body>', '  <script>\n    document.addEventListener("DOMContentLoaded", function(){ initializeCart(); updateCartCount(); });\n  </script>\n</body>', raw, count=1)
    path.write_text(raw, encoding='utf-8')
    print('Updated', path)
print('Done')
