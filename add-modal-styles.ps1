# PowerShell script to update all remaining team pages with persistent cart system

$baseDir = "c:\Users\SIDDHU\Desktop\IPLshoppee\IPL teams"
$teamFiles = @(
  'rcb.html',
  'dc.html',
  'gt.html',
  'kkr.html',
  'lsg.html',
  'pbks.html',
  'rr.html',
  'srh.html'
)

# Modal styles to add (same for all)
$modalStyles = @'
    /* Modal Styles */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
      z-index: 2000;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.active { display: flex; }
    .modal-container {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: sticky;
      top: 0;
      background: rgba(15, 23, 42, 0.95);
    }
    .modal-header h2 { font-size: 1.5rem; font-weight: 900; margin: 0; }
    .close-btn {
      background: none;
      border: none;
      color: #f1f5f9;
      font-size: 2rem;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }
    .close-btn:hover { transform: rotate(90deg); color: #60a5fa; }
    .modal-body { padding: 2rem; }
    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      background: rgba(30, 41, 59, 0.35);
      border-radius: 1rem;
      margin-bottom: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .cart-item-info { flex: 1; }
    .cart-item-name { font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem; }
    .cart-item-price { color: #cbd5e1; font-size: 0.9rem; }
    .cart-item-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .qty-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(20, 30, 48, 0.8);
      padding: 0.25rem;
      border-radius: 0.5rem;
    }
    .qty-btn {
      background: none;
      border: none;
      color: #60a5fa;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      transition: all 0.2s ease;
    }
    .qty-btn:hover { background: rgba(96, 165, 250, 0.2); color: #93c5fd; }
    .qty-display { min-width: 30px; text-align: center; font-weight: 600; }
    .remove-btn {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .remove-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      border-color: rgba(239, 68, 68, 0.5);
    }
    .cart-summary {
      background: rgba(30, 41, 59, 0.35);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1.5rem 2rem;
      position: sticky;
      bottom: 0;
    }
    .cart-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1.25rem;
      font-weight: 900;
      margin-bottom: 1rem;
    }
    .cart-actions {
      display: flex;
      gap: 1rem;
    }
    .checkout-btn {
      flex: 1;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      border: none;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.85rem;
      transition: all 0.3s ease;
    }
    .checkout-btn:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      transform: translateY(-2px);
    }
    .clear-cart-btn {
      flex: 1;
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.85rem;
      transition: all 0.3s ease;
    }
    .clear-cart-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      border-color: rgba(239, 68, 68, 0.5);
    }
    .empty-cart {
      text-align: center;
      padding: 3rem 2rem;
      color: #cbd5e1;
    }
    .empty-cart p { font-size: 1.1rem; margin-bottom: 1.5rem; }
    .product-detail-modal .modal-container { width: 700px; }
    .product-detail-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .product-detail-image {
      font-size: 8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(30, 41, 59, 0.35);
      border-radius: 1rem;
      border: 1px dashed rgba(255, 255, 255, 0.1);
      min-height: 300px;
    }
    .product-detail-info h3 { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.5rem; }
    .product-detail-price { font-size: 2rem; font-weight: 900; color: #60a5fa; margin: 1rem 0; }
    .product-detail-rating { color: #cbd5e1; margin-bottom: 1.5rem; font-size: 0.95rem; }
    .product-detail-description { color: #cbd5e1; line-height: 1.6; margin-bottom: 2rem; font-size: 0.95rem; }
    .product-detail-btn {
      width: 100%;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      border: none;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.85rem;
      transition: all 0.3s ease;
    }
    .product-detail-btn:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      transform: translateY(-2px);
    }
    @media (max-width: 768px) {
      .modal-container { width: 95%; }
      .product-detail-content { grid-template-columns: 1fr; }
      .product-detail-image { min-height: 200px; font-size: 5rem; }
      .cart-item { flex-direction: column; align-items: flex-start; }
      .cart-item-controls { width: 100%; justify-content: space-between; margin-top: 1rem; }
    }
'@

foreach ($file in $teamFiles) {
  $filePath = Join-Path $baseDir $file
  Write-Host "Processing $file..."
  
  $content = Get-Content $filePath -Raw
  
  # Add modal styles before closing style tag
  if ($content -match '\.toast-notification\.show\s*\{\s*transform:\s*translateY\(0\);\s*\}') {
    $content = $content -replace '(\.toast-notification\.show\s*\{\s*transform:\s*translateY\(0\);\s*\})', "`$1`n$modalStyles"
    Set-Content $filePath $content -Force
    Write-Host "  ✓ Added modal styles"
  }
}

Write-Host "`nStyles added to all team pages!"
