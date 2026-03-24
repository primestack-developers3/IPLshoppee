$team_pages = @('csk.html','rcb.html','mi.html','kkr.html','rr.html','srh.html','gt.html','lsg.html','dc.html','pbks.html')
foreach ($page in $team_pages) {
    $path = Join-Path 'IPL teams' $page
    if (-not (Test-Path $path)) { Write-Host "Missing $path" -ForegroundColor Yellow; continue }
    $raw = Get-Content $path -Raw -Encoding UTF8
    if ($raw -notmatch 'src="\.\.\/\.\.\/cart-manager\.js"') {
        $raw = [regex]::Replace($raw, '(<link\s+href="https://fonts\.googleapis\.com/css2\?[^>]*>)', '$1`r`n  <script src="../../cart-manager.js"></script>', 1)
    }
    if ($raw -notmatch 'id="header-container"') {
        $insert = @'
  <!-- Header Component -->
  <div id="header-container"></div>
  <script>
    fetch("../../components/header.html")
      .then(r => r.text())
      .then(html => { document.getElementById("header-container").innerHTML = html; initializeCart(); updateCartCount(); });
  </script>

  <!-- Cart Panel Component -->
  <div id="cart-panel-container"></div>
  <script>
    fetch("../../components/cart-panel.html").then(r => r.text()).then(html => document.getElementById("cart-panel-container").innerHTML = html);
  </script>
'@
        $raw = [regex]::Replace($raw, '(<body[^>]*>)', '$1' + $insert, 1)
    }
    $raw = [regex]::Replace($raw, 'window\.addEventListener\(\'DOMContentLoaded\'[\s\S]*?<\/script>\s*<\/body>', '</body>', 'Singleline')
    if ($raw -notmatch 'initializeCart\(\)') {
        $raw = [regex]::Replace($raw, '<\/body>', '  <script>`r`n    document.addEventListener("DOMContentLoaded", function(){ initializeCart(); updateCartCount(); });`r`n  </script>`r`n</body>', 1)
    }
    Set-Content -Path $path -Value $raw -Encoding UTF8
    Write-Host "Updated $path" -ForegroundColor Green
}
Write-Host 'Done' -ForegroundColor Cyan
