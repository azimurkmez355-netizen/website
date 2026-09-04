# Fortify — website

Bu depo Vercel üzerinden otomatik deploy edilecek şekilde ayarlandı (GitHub'a
her `git push origin main` sonrası Vercel yeni sürümü yayına alır).

- `public/` — statik site (index.html, style.css, script.js)
- `api/` — ziyaretçi takibi ve `/admin` panelini besleyen serverless fonksiyonlar
- `lib/storage.js` — ziyaretçi verisi hafızada tutulur, dışarıda veritabanı yok.
  Bu yüzden yoğun trafikte veya cold start/redeploy sonrası liste sıfırlanabilir.
  `/admin` şifresizdir, siteden hiçbir yere link verilmez.

Yerel geliştirme: `vercel dev`
