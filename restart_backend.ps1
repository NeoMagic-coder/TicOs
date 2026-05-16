# 1. Eğer çalışıyorsa mevcut backend'i kapat
Get-Process | Where-Object { $_.CommandLine -like "*uvicorn*apps.api.main*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Hatalı çevre değişkenini oturumdan kaldır
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue

# 3. Backend'i temiz anahtarla (env.local'den okuyacak şekilde) başlat
uvicorn apps.api.main:app --reload --port 8000
