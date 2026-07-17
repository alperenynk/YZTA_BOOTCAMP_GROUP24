export interface LandingLocation {
  id: string;
  no: string;
  title: string;
  tag: string;
  coords: string;
  lat: number;
  lon: number;
  desc: string;
}

export const LANDING_LOCATIONS: LandingLocation[] = [
  {
    id: "istanbul",
    no: "01",
    title: "Galata, İstanbul",
    tag: "tarihi yarımada · zanaat · boğaz",
    coords: "41.0256° K — 28.9744° D",
    lat: 41.0256,
    lon: 28.9744,
    desc: "Kuleden değil, ara sokaklardan başla: sabah kepengi ilk kaldıran haffaftan bir kahve, öğlen güneşinde ısınmış taş merdivenler. Lokál seni kalabalığın bir sokak gerisine, fenerlerin ilk yandığı o saate kurar.",
  },
  {
    id: "kapadokya",
    no: "02",
    title: "Göreme, Kapadokya",
    tag: "vadiler · kaya oyma · şafak",
    coords: "38.6431° K — 34.8289° D",
    lat: 38.6431,
    lon: 34.8289,
    desc: "Balonlar gökyüzündeyken sen vadide ol: güvercinlikler, tüf taşına oyulmuş bin yıllık sessizlik. Kalabalık Kızılçukur'a akarken Lokál seni yerlilerin bildiği isimsiz bir sırta, gün batımının en sessiz yerine çıkarır.",
  },
  {
    id: "izmir",
    no: "03",
    title: "Kemeraltı, İzmir",
    tag: "çarşı · avlu · kumda kahve",
    coords: "38.4192° K — 27.1287° D",
    lat: 38.4192,
    lon: 27.1287,
    desc: "Bu çarşı bir labirent değil, bir ritim: keşkekçi, demirci, baharatçı — hepsi aynı tempoda çalışır. Lokál seni Kızlarağası'nın avlusunda bir fincan kumda kahveye oturtur; burada acele etmek ayıptır.",
  },
  {
    id: "ayvalik",
    no: "04",
    title: "Cunda, Ayvalık",
    tag: "taş evler · sakız · iskele",
    coords: "39.3192° K — 26.6954° D",
    lat: 39.3192,
    lon: 26.6954,
    desc: "Taş evler, sakız kokusu, iskelede sallanan tekneler. Rota öğle uykusundan sonra başlar: Taksiyarhis'in gölgesi, akşamüstü papalina, gece yarısı sıcak lokma. Burada saat, ada saatine göre işler.",
  },
  {
    id: "antep",
    no: "05",
    title: "Bakırcılar, Gaziantep",
    tag: "usta işi · çarşı · tahmis",
    coords: "37.0662° K — 37.3833° D",
    lat: 37.0662,
    lon: 37.3833,
    desc: "Çekiç sesi burada müziğe dönüşür. Ustanın tezgâhında beş dakika geçir, sonra Tahmis'te bir menengiç kahvesiyle yorgunluk at. Şehir sana baklavayı değil, baklavayı yapan elleri gösterir.",
  },
];
