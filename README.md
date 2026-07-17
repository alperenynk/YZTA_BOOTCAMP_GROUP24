# Lokál — AI Deneyim Asistanı

## Sesli Arama (AssemblyAI)

Keşfet'te "🎙 sesli anlat": tarayıcı mikrofonu (MediaRecorder/webm) →
`POST /api/voice/transcribe` → AssemblyAI Universal-3.5-Pro (Türkçe 18 yerel
dilden biri; `speech_models: ["universal-3-5-pro","universal-2"]` fallback'li,
bağlam `prompt`'u ile). Anahtar sunucuda kalır; kota arama havuzundan düşer;
kayıt sınırı 10 MB. `ASSEMBLYAI_API_KEY` yoksa uç 503 döner (mock modda kapalı).

## Yayına Hazırlık Katmanı

- **Hesap silme + veri indirme** (KVKK): Ayarlar > Verilerin — `DELETE /api/account`
  tüm izleri (auth tabloları dahil) temizler; `GET /api/account/export` JSON döker
- **OG önizleme kartları**: `/r/<token>` linkleri WhatsApp/Twitter'da başlık +
  sharp üretimi 1200×630 görsel kartla açılır (`/api/og/<token>`)
- **Akış sayfalaması**: cursor tabanlı (`?before=<id>`, 20'lik sayfalar) + "daha fazla"
- **Onboarding**: ilk girişte 3 adımlık tur + "örnekle dene"; girişsize "nasıl çalışır"
- **Hava kartı**: `GET /api/today` — kullanıcının semtinde bugünkü hava (OWM)
- **Web push**: VAPID + `push_subscriptions`; zilden "bildirimleri aç" → beğeni/yorum/
  arkadaşlık bildirimleri cihaza gider (`lib/push.ts`, sw.js push handler)
- **Erişilebilirlik**: ikon butonlarda aria-label, form alanlarında etiketler

"Bugün ne yapsak?" sorusuna, kullanıcının serbest metninden (konum, ruh hali,
kiminle, zaman, bütçe) 4 katmanlı öneri üreten web uygulaması:

1. **Biletli Etkinlikler** — web search (Tavily/Serper)
2. **Ücretsiz Etkinlikler** — belediye/açık hava/sergi aramaları
3. **Mekan Önerileri** — Google Places, hava durumuna göre filtreli
4. **LLM Deneyim Paketi** — API'siz, adım adım rota (ayırt edici katman)

## Çalıştırma

```bash
npm install
npm run dev
```

http://localhost:3000 — API key'siz **mock modda** tam akış çalışır
(sahte etkinlik/mekan verisi + sezgisel Türkçe parser).

## API Key'ler

`.env.local` dosyasına ekleyin (şablon: `.env.example`):

| Değişken | Katman | Yokken |
|---|---|---|
| `ANTHROPIC_API_KEY` | LLM parsing + deneyim paketi (`claude-opus-4-8`, structured outputs) | NVIDIA'ya düşer |
| `NVIDIA_API_KEY` | LLM yedeği: NIM / Llama 3.3 70B (ücretsiz kredi, şema prompt'la + zod doğrulama) | Regex tabanlı mock parser + şablon rota |
| `GOOGLE_PLACES_API_KEY` | Mekan katmanı (Places API New, Text Search) | Semt bazlı mock mekanlar |
| `OPENWEATHER_API_KEY` | Hava durumu filtresi | "21°C açık" sabit değeri |
| `TAVILY_API_KEY` / `SERPER_API_KEY` | Biletli + ücretsiz etkinlik katmanları | Mock etkinlik listesi |

Her servis kendi key'ini bağımsız kontrol eder; kısmi entegrasyon mümkündür.
Arayüzde hangi katmanların mock olduğu rozetle gösterilir.

## Öne Çıkan Akışlar

- Arama herkese görünür; kutuya odaklanınca girişsiz kullanıcıya **login modalı** açılır
- Etkinlik araması **alan kısıtlı** (Biletix/Bubilet/Passo + İBB ve ilçe belediyeleri),
  ardından LLM "hedef tarihte gerçekten var mı?" ayıklaması yapar
- Deneyim paketi rotası Places'tan gelen **gerçek mekanları** kullanır
- **🎲 başka öner** ile aynı metinden yeni paket; profildeki geçmiş aramalardan
  **eski sonuçlara dönülebilir** (`/history/[id]`)
- Semt çıkarılamazsa **konum yardımı**: elle semt girme ya da tarayıcı konumu
  (Nominatim ters geokodlama)
- **Gece/gündüz (krem) modu**, tercih localStorage'da
- **Şifre sıfırlama**: Resend ile mail (key yoksa mail konsola yazılır)

## Topluluk 2.0 & Ürünleşme

- **Rozetler**: dinamik hesaplanan 7 rozet (İlk Adım, Kâşif, Gece Kuşu…) +
  profilde istatistik şeridi (aylık plan, favori katman/semt)
- **Arkadaşlık**: e-postayla istek → kabul/reddet (profil > Arkadaşlar);
  grup planında arkadaşlar tek tıkla çip olarak seçilir
- **Bildirimler**: beğeni/yorum/arkadaşlık olayları → header'da 🔔 (dakikada bir tazelenir)
- **Rota paylaşımı**: kartta "🔗 paylaş" → `/r/<token>` herkese açık sayfa + kayıt CTA'sı
- **Sohbet modu**: sonuç ekranında "✏️ pakete yön ver" → `/api/suggest/revise`
  deneyim paketini talimata göre yeniden üretir (mock modda dürüst placeholder)
- **Moderasyon**: her postta ⚑ şikayet; `ADMIN_EMAILS`'teki hesaplar akışta 🛡 silme
  + `/admin` paneli (bekleyen şikayetler, çöz/sil)
- **PWA**: manifest + ikonlar + minimal service worker — telefona kurulabilir
- **KVKK**: `/privacy` aydınlatma metni, kayıtta zorunlu onay kutusu, footer linki

## Sosyal + Koruma Katmanı

- **Post silme** (`DELETE /api/posts/[id]`, sadece sahibi) ve **yorumlar**
  (`/api/posts/[id]/comments`, 300 karakter, saatte 30)
- **Rate limiting**: arama 15/saat, paylaşım 10/saat, yorum 30/saat (SQLite
  sayımlı, `lib/ratelimit.ts`)
- **Görsel küçültme**: sharp ile post görselleri 1600px/webp'e, avatarlar
  512px kare webp'e çevrilir (gif'lere dokunulmaz)
- **E-posta doğrulama**: kayıtta doğrulama maili gider (`sendOnSignUp`);
  `requireEmailVerification` Resend key'i gelene dek kapalı (açmak tek satır)
- **Semt fallback**: metinde konum yoksa profildeki semt kullanılır
- **Takvime ekle**: her öneri kartından `.ics` indirme (Europe/Istanbul)
- **Grup planı**: "👥 birlikte planla" → arkadaş e-postaları (≤3, kayıtlı olmalı);
  profiller birleşip LLM'e gider, `groups`/`group_members` tablolarına yazılır
- **Etkinlik DB**: `events` tablosu + `GET /api/cron/events` (Bearer CRON_SECRET)
  gece taraması; aramalar önce bu tabloya bakar, yetersizse canlı aramaya düşer.
  Cron, arama+LLM key'leri olmadan dürüstçe atlar.

## Kişiselleşme & Topluluk

- **Profil özeti**: her 3 geri bildirimde bir LLM (yoksa istatistik şablonu)
  kullanıcının zevk profilini üretir (`profile_summaries`); profil sayfasında görünür
  ve deneyim rotası üretimine geri beslenir
- **Topluluk akışı (`/feed`)**: Threads tarzı ayrı sekme — üstte "Ne yenilikler
  var?" kutusu (metin + görsel yükleme + "gittiğim etkinlik" seçici), altta
  avatar/zaman etiketli akış ve beğeni (♥). Görseller `data/uploads/` altında,
  `/api/uploads/[name]` üzerinden servis edilir (5 MB sınır, tip doğrulama).
  "Gittim" akışındaki "🌍 paylaş" kutusu da aynı akışa düşer
- **Haftalık tarama cron'u**: `GET /api/cron/weekly` (Bearer `CRON_SECRET`) — her
  kullanıcı için profili tazeler, son konumuna göre hafta sonu önerisi üretir,
  hava güzelse "☀️ Fırsat" satırıyla e-posta yollar. Crontab/Vercel Cron ile haftada
  bir tetiklenebilir: `0 9 * * 4` (perşembe 09:00)
- **Harita**: deneyim rotasında "🗺 haritada gör" — adımlar Nominatim ile
  konumlanır, Leaflet/OSM üzerinde numaralı ve noktalı rota çizilir
- **Streaming arayüz**: `/api/suggest/stream` NDJSON akışı; katmanlar hazır
  oldukça ekrana düşer, aşama etiketi gösterilir

## Kullanıcı Girişi

Better Auth ile e-posta/şifre auth (aynı SQLite dosyasında `user`, `session`,
`account` tabloları). `/register` ve `/login` sayfaları; tüm API uçları oturum
ister (401 → login'e yönlendirme). `BETTER_AUTH_SECRET` env değişkeni zorunlu
(`openssl rand -hex 32` ile üret). Uygulama içi profil `users` tablosunda,
Better Auth kullanıcısına `users.auth_id` ile bağlanır (ilk girişte otomatik
oluşur). İleride Google girişi eklemek Better Auth config'inde birkaç satır.

## Mimari

```
app/api/suggest   POST { raw_text } → parse → paralel(venues, events, weather, experience) → DB → 4 katman
app/api/feedback  POST { suggestion_id, went, liked, note }
app/api/profile   GET  → kullanıcı + geçmiş aramalar + geri bildirimler

lib/llm.ts             Anthropic entegrasyonu (parse + deneyim paketi) + mock fallback
lib/suggest.ts         Orkestratör + "neden bu öneri?" üretimi
lib/services/places.ts Google Places (mock fallback)
lib/services/weather.ts OpenWeatherMap (mock fallback)
lib/services/search.ts Tavily → Serper → mock zinciri
lib/db.ts              better-sqlite3, şema + tek kullanıcı tohumu (data/lokal.db)
```

Veri modeli: `users`, `queries`, `suggestions`, `feedback`,
`profile_summaries` (Faz 2), `groups` + `group_members` (Faz 2).

## Faz 2 (planlandı, kod yok)

- Periyodik LLM profil özeti (`profile_summaries` tablosu hazır)
- Grup önerileri: `@isim` etiketleme, ortak/çatışan tercih analizi (`groups` hazır)
- "Şu an" vs "bu hafta sonu" zaman boyutu
- Scheduled agent + bildirim ("profiline uygun etkinlik var")
- Monetizasyon notu: Free/Plus abonelik, mekan indirim ortaklıkları
