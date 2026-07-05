# Sprint 1 Review

## Alınan Kararlar

Sprint sonunda ürünün MVP'si tamamlanmıştır: sohbet tabanlı öneri arayüzü, tarih hassasiyetli etkinlik önerisi, üyelik sistemi (giriş/kayıt, şifre sıfırlama), topluluk akışı (görsel paylaşımı, beğeni, etkinlik etiketi), kullanıcı profili (kapak/avatar, sekmeler), harita görünümü ve haftalık e-posta altyapısı geliştirilmiştir.

Çıkan ürünün çalışmasında ve mock (örnek veri) modunda yapılan uçtan uca testlerde bir problem görülmemiştir. Gerçek servis anahtarlarının (hava durumu, yapay zeka modeli, mekan araması, e-posta gönderimi) temin edilip girilmesi tamamlanamadığı için, gerçek veriyle canlı test PBI'ı bir sonraki sprint'e aktarılmıştır. Benzer şekilde paralı üyelik altyapısı tasarlanmış ancak kodlaması bir sonraki sprint'e bırakılmıştır.

Ekstra koyulması gereken özellikler belirlenmiştir: paralı üyelik planları (günlük kullanım limiti), yayın öncesi kalıcı veritabanına geçiş, istek sınırlama (rate limiting) ve otomatik testler.

Tasarım kararı: krem zemin "fazla yapay zeka görünümü" verdiği için reddedilip beyaz zemin + marka yeşili (#4A5D43) varsayılan tema olarak onaylanmıştır; gece modu koyu orman yeşili olarak belirlenmiştir.

## Sprint Review Katılımcıları
- Duru Kahraman
- Elif Özlem Bağcı
- Emre Karataş
- Aybüke Karaçavuş
- Alperen Yanık

## Sprint Retrospective

- Takım içindeki görev dağılımıyla ilgili düzenleme yapılması kararı alınmıştır; özellikle API anahtarlarının temini ve aktivasyonu (e-posta doğrulaması dahil) için sorumlu kişi netleştirilmelidir.
- Tahmin puanları gözden geçirilmeli ve sprint planlama toplantılarında gerekli geri bildirimlerin developer'lar tarafından verildiğine emin olunmalıdır; bu sprint'te dış servis entegrasyonlarının (key aktivasyonu gibi bekleme süreleri) eforu olduğundan düşük tahmin edilmiştir.
- Unit test'ler için ayrılan efor/saat arttırılmalıdır; bu sprint'te testler mock modda manuel yapılmıştır, bir sonraki sprint'te otomatik test yazımına zaman ayrılmalıdır.
- Mock veriden gerçek servislere geçiş bir sonraki sprint'in başında ele alınmalı, maliyet kontrolü için düşük maliyetli model seçeneğiyle başlanmalıdır.
