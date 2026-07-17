import Link from "next/link";

export const metadata = { title: "Gizlilik Politikası — Lokál" };

// KVKK aydınlatma metni (MVP sürümü — yayına çıkmadan hukuki gözden geçirme önerilir)
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-dusk-100">
      <h1 className="font-display text-3xl font-semibold">
        Gizlilik Politikası &amp; KVKK Aydınlatma Metni
      </h1>
      <p className="font-mono text-xs text-dusk-300">Son güncelleme: Temmuz 2026</p>

      <Section title="1. Hangi verileri topluyoruz?">
        Hesap oluştururken <strong>ad, e-posta ve şifre</strong> (şifreler geri
        döndürülemez şekilde özetlenerek saklanır); dilersen{" "}
        <strong>profil fotoğrafı, doğum tarihi ve semt</strong> bilgisi; uygulamayı
        kullanırken <strong>arama metinlerin, geri bildirimlerin, paylaşımların ve
        yorumların</strong>. Tarayıcı konumunu yalnızca sen izin verirsen ve
        yalnızca semt tespiti için anlık kullanırız; koordinatların saklanmaz.
      </Section>

      <Section title="2. Verileri ne için kullanıyoruz?">
        Sana kişiselleştirilmiş etkinlik ve mekan önerileri üretmek, zevk profilini
        çıkarmak, istersen haftalık öneri e-postası göndermek ve topluluk akışını
        çalıştırmak için. Arama metinlerin, öneri üretimi amacıyla yapay zeka servis
        sağlayıcımıza (Anthropic) iletilebilir; reklam amaçlı hiçbir üçüncü tarafla
        paylaşılmaz, verilerin satılmaz.
      </Section>

      <Section title="3. Paylaşımların görünürlüğü">
        Topluluk akışına attığın paylaşımlar (metin, görsel, etkinlik etiketi){" "}
        <strong>tüm kullanıcılara ve giriş yapmamış ziyaretçilere</strong> görünür.
        Paylaşımlarını istediğin an silebilirsin; silinen içerik sunucudan da kaldırılır.
      </Section>

      <Section title="4. Saklama ve güvenlik">
        Verilerin, uygulamanın veritabanında saklanır ve hesabını sildiğinde ya da
        talep ettiğinde kaldırılır. Oturumlar imzalı çerezlerle korunur; şifre
        sıfırlama bağlantıları süreli ve tek kullanımlıktır.
      </Section>

      <Section title="5. KVKK kapsamındaki hakların">
        6698 sayılı KVKK'nın 11. maddesi uyarınca: verilerine erişme, düzeltme,
        silme, işlemeye itiraz etme ve verilerinin aktarıldığı tarafları öğrenme
        hakkına sahipsin. Talepler için bize e-posta ile ulaşabilirsin.
      </Section>

      <Section title="6. Çerezler">
        Yalnızca oturumunu açık tutmak için zorunlu çerezler ve tema tercihin için
        yerel depolama kullanılır; takip/reklam çerezi kullanılmaz.
      </Section>

      <p className="border-t border-dusk-700/60 pt-4">
        <Link href="/" className="font-mono text-xs text-teal-glow hover:underline">
          ← ana sayfaya dön
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-display text-lg font-semibold text-dusk-100">
        {title}
      </h2>
      <p className="text-dusk-200">{children}</p>
    </section>
  );
}
