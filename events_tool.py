import os
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

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
            if o.link:
                sonuc += f"  Link: {o.link}\n"
        if self.hata:
            sonuc += f"Hata: {self.hata}"
        return sonuc
# --- Geçici şemalar sonu ---


def events_tool(intent: ParsedIntent) -> ToolResult:
    try:
        oneriler = []

        # 1) Biletli etkinlikler
        biletli_sorgu = f"{intent.konum} konser tiyatro Bubilet Biletix bu hafta"
        biletli_sonuc = tavily.search(query=biletli_sorgu, max_results=3)

        for item in biletli_sonuc.get("results", []):
            oneriler.append(Oneri(
                baslik=item.get("title", "Etkinlik"),
                aciklama=item.get("content", "")[:200],
                kategori="biletli",
                konum=intent.konum,
                link=item.get("url")
            ))

        # 2) Ücretsiz etkinlikler
        ucretsiz_sorgu = f"{intent.konum} belediye ücretsiz etkinlik festival sergi"
        ucretsiz_sonuc = tavily.search(query=ucretsiz_sorgu, max_results=3)

        for item in ucretsiz_sonuc.get("results", []):
            oneriler.append(Oneri(
                baslik=item.get("title", "Etkinlik"),
                aciklama=item.get("content", "")[:200],
                kategori="ucretsiz",
                konum=intent.konum,
                link=item.get("url")
            ))

        if not oneriler:
            return ToolResult(
                tool="events",
                basarili=False,
                oneriler=[],
                hata="Etkinlik bulunamadı"
            )

        return ToolResult(
            tool="events",
            basarili=True,
            oneriler=oneriler
        )

    except Exception as e:
        return ToolResult(
            tool="events",
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
        butce="orta"
    )
    sonuc = events_tool(intent)
    print(sonuc)
