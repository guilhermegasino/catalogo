const INITIAL_PRODUCTS = [
  {
    name: "Lattafa Pride - La Collection d'Antiquités 1505 - 100ml",
    priceWholesale: 189.00,
    priceSuggested: 320.00,
    description: "Fragrância sofisticada e madura da linha Pride. Destaca-se por uma saída marcante de cereja negra e açafrão, corpo resinoso de incenso (olíbano) e fundo amadeirado de sândalo e guaiaco. Semelhante ao estilo Cherry Smoke.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa - Sheikh Al Shuyukh Supreme - 100ml",
    priceWholesale: 159.00,
    priceSuggested: 290.00,
    description: "Um perfume oriental especiado quente e marcante. Mistura notas tradicionais de canela, açafrão e rosa com um coração irresistível de caramelo e patchouli, finalizando com baunilha e notas amadeiradas.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Maison Alhambra - Perseus Exclusif - 100ml",
    priceWholesale: 175.00,
    priceSuggested: 320.00,
    description: "Fragrância especiada, amadeirada e aromática com presença marcante. Abre com notas de cardamomo, heliotrópio e bergamota, coração amendoado com lavanda e fundo cremoso de baunilha, sândalo e guaiaco.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Al Wataniah - Attar Al Wesal - 100ml",
    priceWholesale: 149.00,
    priceSuggested: 280.00,
    description: "Perfume sedutor, doce e especiado. Uma das inspirações mais elogiadas e suaves do clássico JPG Ultra Male. Abre com pera, lavanda e hortelã, evoluindo para notas quentes de canela, com fundo de baunilha negra e âmbar.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Al Wataniah - Sultan Al Lail - 100ml",
    priceWholesale: 155.00,
    priceSuggested: 299.00,
    description: "Perfume aromático, cítrico e amadeirado super revigorante. Abre com laranja sanguínea, bagas de zimbro e limão siciliano, corpo com sálvia, lavanda e gerânio, e fundo clássico masculino de vetiver, cedro e patchouli.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Armaf - Odyssey Dubai Chocolat - 100ml",
    priceWholesale: 195.00,
    priceSuggested: 350.00,
    description: "Perfume gourmand marcante e inovador. Traz as notas que remetem ao famoso chocolate de pistache de Dubai. Saída de café, pistache, knafeh e avelã, evoluindo para chocolate belga, baunilha e caramelo.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa Pride - Safwaan L'Autre Oud - 100ml",
    priceWholesale: 215.00,
    priceSuggested: 390.00,
    description: "Fragrância luxuosa e exótica da linha premium da Lattafa. Celebra o Oud (madeira de Agar) de forma suave e elegante, cercado por notas de rosa damascena, especiarias quentes e âmbar dourado.",
    category: "Fragrâncias de Nicho",
    image: "https://images.unsplash.com/photo-1588405748373-122b2321bc31?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa - Maahir Gold - 100ml",
    priceWholesale: 199.00,
    priceSuggested: 360.00,
    description: "O icônico perfume do frasco com cabeça de cavalo dourada. Uma fragrância imponente com saída frutada de pêssego e frutas vermelhas, corpo floral e fundo rico de baunilha, sândalo, almíscar e notas de camurça.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "French Avenue - Vulcan Feu - 100ml",
    priceWholesale: 185.00,
    priceSuggested: 340.00,
    description: "A famosa 'bomba de manga' fresca e tropical. Inspirado no luxuoso God of Fire, traz notas suculentas de manga, gengibre, ruibarbo e limão, corpo especiado e fundo marcante de fava tonka e âmbar cinzento.",
    category: "Fragrâncias de Nicho",
    image: "https://images.unsplash.com/photo-1582211594533-268f4f1edeb9?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa - Khamrah Qahwa - 100ml",
    priceWholesale: 245.00,
    priceSuggested: 449.00,
    description: "Fragrância altamente viciante e elogiada mundialmente. Evolução do famoso Khamrah original, agora com um toque rico de café torrado arábico. Abre com canela, tâmara e pralinê, sobre notas de café e baunilha.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Al Haramain - Amber Oud Dubai Night - 120ml",
    priceWholesale: 320.00,
    priceSuggested: 580.00,
    description: "Perfume rico, denso e sofisticado da consagrada linha Amber Oud. Evoca o mistério das noites de Dubai com notas opulentas de açafrão, oud, rosa búlgara, âmbar, musgo de carvalho e almíscar branco.",
    category: "Fragrâncias de Nicho",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa - Asad Tradicional - 100ml",
    priceWholesale: 169.00,
    priceSuggested: 320.00,
    description: "Um dos perfumes árabes mais vendidos no Brasil. Famoso por sua similaridade incrível com Sauvage Elixir. Uma fragrância especiada e quente com pimenta preta, abacaxi, patchouli, café, baunilha e madeiras secas.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Lattafa - Asad Zanzibar - 100ml",
    priceWholesale: 189.00,
    priceSuggested: 349.00,
    description: "O novo lançamento da Lattafa, versão fresca e praiana do consagrado Asad. Traz um aroma surpreendente de água de coco, sal e pimenta preta na saída, coração com íris e fundo incensado com baunilha.",
    category: "Perfumes Árabes",
    image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80"
  }
];

if (typeof module !== 'undefined') {
  module.exports = INITIAL_PRODUCTS;
}
