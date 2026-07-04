import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# --- Geçici şemalar (Alperen yayınlayınca burası silinecek) ---
class ParsedIntent:
    def __init__(self, konum, kisi, enerji, zaman, butce="orta", ham_metin=""):
        self.konum = konum
        self.kisi = kisi
        self.enerji = enerji
        self.zaman = zaman
        self.butce = butce
        self.ham_metin = ham_metin

class Oneri:
    def __init__(self, baslik, aciklama, kategori, konum, link=None, ekstra={}):
        self.baslik = baslik
        self.aciklama = aciklama
        self.kategori = kategori
        self.konum = konum
        self.link = link
        self.ekstra = ekstra

class ToolResult:
    def __init__(self, tool, basarili, oneriler, hata=None):
        self.tool = tool
        self.basarili = basarili
        self.oneriler = oneriler
        self.hata = hata

    def __repr__(self):
        sonuc = f"Tool: {self.tool} | Başarılı: {self.basarili}\n"
        for o in self.oneriler:
            sonuc += f"\n  [{o.kategori}] {o.baslik}\n  {o.aciklama}\n"
        if self.hata:
            sonuc += f"Hata: {self.hata}"
        return sonuc
# --- Geçici şemalar sonu ---


def experience_tool(intent: ParsedIntent) -> ToolResult:
    try:
        prompt = f"""Sen bir İstanbul şehir rehberisin. Kullanıcının durumuna göre 2-3 adet SOMUT, yürünebilir deneyim planı üret.

Kullanıcı bilgileri:
- Konum: {intent.konum}
- Kişi: {intent.kisi}
- Enerji seviyesi: {intent.enerji}
- Zaman: {intent.zaman}
- Bütçe: {intent.butce}

Kurallar:
- Her plan adım adım olsun (nereden ne al, nereye git, ne yap)
- Gerçek mahalle ve mekan isimleri kullan
- Enerji düşükse sakin, yüksekse hareketli planlar öner
- Her planı şu formatta yaz:

PLAN_BASLIGI: ...
PLAN_ACIKLAMASI: ...
"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )

        metin = response.choices[0].message.content

        # Planları parse et
        oneriler = []
        planlar = metin.strip().split("PLAN_BASLIGI:")
        for plan in planlar:
            if not plan.strip():
                continue
            satirlar = plan.strip().split("\n")
            baslik = satirlar[0].strip()
            aciklama = ""
            for satir in satirlar[1:]:
                if "PLAN_ACIKLAMASI:" in satir:
                    aciklama = satir.replace("PLAN_ACIKLAMASI:", "").strip()
            if baslik:
                oneriler.append(Oneri(
                    baslik=baslik,
                    aciklama=aciklama,
                    kategori="deneyim_paketi",
                    konum=intent.konum
                ))

        return ToolResult(
            tool="experience",
            basarili=True,
            oneriler=oneriler
        )

    except Exception as e:
        return ToolResult(
            tool="experience",
            basarili=False,
            oneriler=[],
            hata=str(e)
        )


# Test
if __name__ == "__main__":
    intent = ParsedIntent(
        konum="Kadıköy, İstanbul",
        kisi="çift",
        enerji="düşük-orta",
        zaman="akşam",
        butce="orta",
        ham_metin="Sevgilimle Kadıköy'deyiz, biraz yorgunuz ama akşamı değerlendirmek istiyoruz"
    )
    sonuc = experience_tool(intent)
    print(sonuc)