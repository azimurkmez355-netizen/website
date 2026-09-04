# Fortify — website

Bu depo Railway üzerinden otomatik deploy edilecek şekilde ayarlandı (GitHub'a
her `git push origin main` sonrası Railway yeni sürümü yayına alır).

- `public/` — statik site (index.html, style.css, script.js)
- `server.js` — Express sunucusu: statik siteyi servis eder, ziyaretçi takibi
  API'lerini (`/api/visit`, `/api/heartbeat`, `/api/click`) ve `/admin`
  panelini barındırır
- Ziyaretçi verisi hafızada tutulur ve `data/visits.json` dosyasına
  yedeklenir (yalnızca aynı deploy içinde kalıcı — yeni bir `git push`
  sonrası liste sıfırlanır). `/admin` şifresizdir, siteden hiçbir yere
  link verilmez.

Yerel geliştirme: `npm install && node server.js`
