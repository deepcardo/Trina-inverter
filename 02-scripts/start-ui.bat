@echo off
chcp 65001 >nul
cd /d "D:\Code\tools"

powershell -ExecutionPolicy Bypass -Command ^
$Port=8080; $Root='D:\Code\tools'; ^
try { ^
  $v=python --version 2>&1; if ($LASTEXITCODE -ne 0) { throw 'no python' } ^
} catch { ^
  Write-Host '[x] Python is required.' -ForegroundColor Red; pause; exit 1 ^
}; ^
try { ^
  $l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$Port); ^
  $l.Start(); $l.Stop() ^
} catch { ^
  Write-Host (\"[x] Port $Port is in use.\") -ForegroundColor Red; pause; exit 1 ^
}; ^
Clear-Host; ^
Write-Host '========================================' -ForegroundColor Cyan; ^
Write-Host '     Tool: Excel Convert / Test UI      ' -ForegroundColor Cyan; ^
Write-Host '========================================' -ForegroundColor Cyan; ^
Write-Host ''; ^
Write-Host '  [1] Data Converter  (convert-excel-ui)' -ForegroundColor Yellow; ^
Write-Host '  [2] Test Runner     (test-verify-ui)' -ForegroundColor Yellow; ^
Write-Host '  [3] Open Both' -ForegroundColor Yellow; ^
Write-Host '  [0] Exit' -ForegroundColor Yellow; ^
Write-Host ''; ^
$choice=Read-Host 'Choose [0-3]'; ^
$pages=switch ($choice) { ^
  '1' { @('scripts/convert-excel-ui.html') } ^
  '2' { @('scripts/test-verify-ui.html') } ^
  '3' { @('scripts/convert-excel-ui.html','scripts/test-verify-ui.html') } ^
  '0' { exit 0 } ^
  default { Write-Host '[x] Invalid choice' -ForegroundColor Red; pause; exit 0 } ^
}; ^
Write-Host (\"[*] Starting HTTP server on port $Port ...\") -ForegroundColor Green; ^
$job=Start-Job -ScriptBlock { param($d,$p) Set-Location $d; python -m http.server $p } -ArgumentList $Root,$Port; ^
Start-Sleep 2; ^
$running=Get-Job -Id $job.Id ^| Where-Object { $_.State -eq 'Running' }; ^
if (-not $running) { ^
  Write-Host '[x] Server failed to start' -ForegroundColor Red; pause; exit 1 ^
}; ^
foreach ($p in $pages) { ^
  $url=\"http://localhost:$Port/$p\"; Start-Process $url; ^
  Write-Host (\"  -> $url\") -ForegroundColor Green ^
}; ^
Write-Host ''; ^
Write-Host 'Server is running. Press any key to stop and exit...' -ForegroundColor Cyan; ^
$null=$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); ^
Stop-Job -Id $job.Id; Remove-Job -Id $job.Id; ^
Write-Host '[*] Server stopped' -ForegroundColor Yellow

pause
