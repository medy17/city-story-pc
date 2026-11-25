const fs = require("fs");
const path = require("path");

// Curated authentic names from visual inspection of every decoded sprite sheet!
const NAMES = {
  // === RESIDENCES (1xxx) ===
  1001: "Suburban House",
  1002: "Cottage",
  1003: "Craftsman Home",
  1004: "Townhouse",
  1005: "Modern Villa",
  1006: "Victorian Mansion",
  1007: "Colonial House",
  1008: "Blue Bungalow",
  1009: "Ranch House",
  1010: "Brownstone",
  1011: "Contemporary Home",
  1012: "Country House",
  1013: "Brick Apartments",
  1014: "Glass Condos",
  1015: "Eco Apartments",
  1016: "City Tenement",
  1018: "Penthouse Suites",
  1019: "Lilac Cottage",
  1020: "Blue Trailer",
  1021: "Retro Mobile Home",
  1022: "Rosewood Cabin",
  1023: "Coastal Bungalow",
  1024: "Mediterranean Villa",
  1025: "Haunted Mansion",
  1026: "Spooky Manor",
  1027: "Ghostly Estate",
  1028: "Abandoned House",
  1029: "Pumpkin House",
  1030: "Autumn Manor",
  1031: "Harvest Home",
  1032: "Penguin Igloo",
  1033: "Holiday Cottage",
  1034: "Alpine Chalet",
  1035: "Ice Palace",
  1036: "Skyline Tower",
  1037: "Spanish Hacienda",
  1038: "Luxury Resort Condo",
  1039: "Art Deco Tower",
  1040: "Fairy Tale Cottage",
  1041: "Barrel Treehouse",
  1042: "Beachfront Villa",
  1043: "Minimalist Loft",
  1044: "Metro Flats",
  1045: "Zen Pagoda Home",
  1046: "Bio Dome Home",
  1047: "Lunar Dome",
  1048: "Sapphire Glass House",
  1049: "Tropical Lagoon Villa",
  1050: "Timber Arch Home",
  1051: "Houseboat",
  1052: "Rooftop Garden Home",
  1053: "Lavender Victorian",
  1054: "Waterfall House",
  1055: "Grand Estate",
  1056: "Pink Blossom Villa",
  1057: "Terrace Mansion",

  // === BUSINESSES (2xxx) ===
  2001: "Town Hall",
  2002: "Schoolhouse",
  2003: "Coffee Shop",
  2004: "Pretzel Bakery",
  2005: "Mimi's Boutique",
  2006: "Corner Store",
  2007: "Movie Theater",
  2008: "Community Pool",
  2009: "Office Building",
  2010: "Tennis Club",
  2011: "City Library",
  2013: "City Church",
  2014: "Post Office",
  2015: "Fire Station",
  2016: "Grand Hotel",
  2017: "Police Station",
  2018: "Parking Lot",
  2019: "Retro Diner",
  2020: "M's Fast Food",
  2021: "Gas Station",
  2022: "Storage Depot",
  2023: "City Bank",
  2024: "Vet Clinic",
  2025: "Corporate Plaza",
  2026: "Law Offices",
  2029: "Curved Glass Tower",
  2030: "Parking Garage",
  2031: "Pet Shop",
  2032: "Auto Repair Shop",
  2033: "Sail Hotel",
  2034: "Empire Tower",
  2035: "Solar Farm",
  2036: "Wind Turbines",
  2037: "Chinese Restaurant",
  2038: "Cylinder Skyscraper",
  2039: "Ice Cream Parlor",
  2040: "Medical Clinic",
  2041: "Pasta House",
  2042: "Civic Center",
  2043: "Golden Mall",
  2044: "Pumpkin Patch",
  2045: "Dragon Tower",
  2046: "Gothic Citadel",
  2047: "Classic Carousel",
  2048: "Ferris Wheel",
  2049: "Roller Coaster Park",
  2050: "Carnival Carousel",
  2051: "Ice Skating Rink",
  2052: "Winter Lodge",
  2053: "Neon Cyber Tower",
  2054: "Barber Shop",
  2055: "Gold Beacon Tower",
  2056: "Fairytale Castle",
  2057: "Rose Plaza Hotel",
  2058: "Cupcake Bakery",
  2059: "Flower Shop",
  2060: "Steakhouse",
  2061: "Tech Campus",
  2062: "History Museum",
  2063: "Candy Shop",
  2064: "Diamond Jeweler",
  2065: "Bowling Alley",
  2066: "Botanical Greenhouse",
  2067: "Donut Shop",
  2068: "BBQ Patio",
  2069: "Taco Stand",
  2070: "Cantina Grill",
  2071: "Sandwich Shop",
  2072: "Country Club",
  2073: "Garden Market",
  2074: "Surf Shop",
  2075: "Fireworks Stand",
  2076: "Electronics Store",
  2077: "Toy Store",
  2078: "Oceanic Skyscraper",
  2079: "Art Deco Skyscraper",
  2080: "Taj Mahal",
  2081: "Roastery Cafe",
  2082: "Fashion Center",
  2083: "Sushi Bar",
  2084: "Grand Aquarium Mall",
  2085: "International Airport",
  2086: "Twin Glass Plaza",
  2087: "Beauty Salon",
  2088: "Car Dealership",
  2089: "Comic Book Store",
  2090: "Cosmetics Boutique",
  2091: "Modern Art Museum",
  2092: "Hardware Store",
  2093: "Dockside Fish Market",
  2094: "Fruit Stand",
  2095: "Bridal Boutique",
  2096: "Gelato Cart Plaza",
  2097: "Ramen House",
  2098: "Seafood Shack",
  2099: "Tiki Beach Bar",

  // === FACTORIES (3xxx) ===
  3001: "City Factory",
  3002: "Industrial Plant",

  // === ROADS, RIVERS, DECORATIONS & LANDMARKS (4xxx) ===
  4001: "City Road",
  4003: "Park Bench",
  4004: "Central Park",
  4005: "Playground",
  4006: "Marble Fountain",
  4008: "Oak Grove",
  4009: "Maple Trees",
  4010: "Grassy Hill",
  4011: "Soccer Field",
  4012: "City River",
  4013: "Meadow Tile",
  4015: "Statue of Liberty",
  4016: "Eiffel Tower",
  4017: "Baseball Diamond",
  4018: "Duck Pond",
  4019: "Basketball Court",
  4020: "Football Field",
  4021: "Palm Trees",
  4022: "Equestrian Statue",
  4023: "Big Ben",
  4024: "St. Basil's Cathedral",
  4025: "Grass Lawn",
  4026: "Clover Patch",
  4029: "Boxwood Hedge",
  4030: "Trimmed Hedge",
  4031: "Skate Park",
  4032: "Spooky Cemetery",
  4033: "Yellow Flowerbed",
  4034: "Green Garden Row",
  4035: "Cyan Flowerbed",
  4036: "Lavender Bed",
  4037: "Pink Flowerbed",
  4038: "Red Tulip Bed",
  4039: "Marigold Bed",
  4040: "White Daisy Bed",
  4041: "Dark Garden Soil",
  4042: "USA Flag",
  4043: "Canada Flag",
  4044: "UK Flag",
  4045: "France Flag",
  4046: "Germany Flag",
  4047: "Russia Flag",
  4048: "China Flag",
  4049: "Japan Flag",
  4050: "South Korea Flag",
  4051: "Mexico Flag",
  4052: "Australia Flag",
  4053: "Switzerland Flag",
  4060: "Crashed UFO",
  4061: "Spooky Tree",
  4063: "Hockey Rink",
  4064: "Giant Snowman",
  4065: "Grand Christmas Tree",
  4066: "Mount Fuji",
  4067: "Frozen Mammoth",
  4068: "Snowy Pine Tree",
  4069: "Winter Pines",
  4070: "Autumn Trees",
  4071: "New Year Plaza",
  4072: "Globe Monument",
  4073: "Baseball Stadium",
  4074: "Outdoor Stage",
  4075: "City Billboard",
  4076: "Water Tower",
  4077: "Newsstand",
  4078: "Stone Sidewalk",
  4079: "Park Path",
  4080: "Cherry Blossom Tree",
  4081: "Recycling Alley",
  4082: "Walled Courtyard",
  4083: "Notre Dame Cathedral",
  4084: "I Love City Story Sign",
  4085: "Construction Yard",
  4086: "Grand Plaza Fountain",
  4087: "Power Plant",
  4088: "Observation Tower",
  4089: "Subway Entrance",
  4090: "Koi Bridge Garden",
  4091: "Weeping Willow",
  4092: "Patriotic Fair",
  4093: "Hot Air Balloon",
  4094: "Golden Pagoda",
  4095: "Torii Shrine",
  4096: "Zen Pond Pavilion",
  4097: "Tokyo Tower",
  4098: "Samurai Castle",
  4099: "Japanese Garden",

  // === SPECIAL BUSINESSES & WORLD LANDMARKS (8xxx) ===
  8001: "The Gherkin",
  8002: "Roadside Motel",
  8003: "Shoe Emporium",
  8004: "Dance Club",
  8005: "Jazz Club",
  8006: "Piano Lounge",
  8007: "Rock Club",
  8008: "Record Store",
  8009: "Clock Manor",
  8010: "Teacup Cafe",
  8011: "Electronics Mart",
  8012: "Motorcycle Shop",
  8013: "Fiesta Sombrero Bar",
  8014: "Futuristic Museum",
  8015: "Grand Theater",
  8016: "Wave Skyscraper",
  8017: "General Hospital",
  8018: "Crystal Convention Hall",
  8019: "Sydney Opera House",
  8020: "Custom Bike Shop",

  // === CIVIC LANDMARKS & PARKS (9xxx) ===
  9001: "River Arch Bridge",
  9002: "Green Warehouse",
  9003: "Transit Hub",
  9004: "Sunflower Planter",
  9005: "Bike Share Station",
  9006: "Bulldog Statue",
  9007: "Hot Dog Cart Plaza",
  9008: "Garden Gazebo",
  9009: "I Heart U Garden",
  9010: "Treble Clef Monument",
  9011: "Canal Walkway",
  9012: "Pavilion Amphitheater",
  9013: "Mediterranean Archway",
  9014: "World Cup Stadium"
};

function buildCatalog(assetsDir, outputCatalogPath) {
  const meta = JSON.parse(fs.readFileSync(path.join(assetsDir, "sprite_meta.json"), "utf8"));
  const thumbsDir = path.join(assetsDir, "thumbs");
  const thumbs = new Set(fs.existsSync(thumbsDir) ? fs.readdirSync(thumbsDir) : []);

  function getTileSize(id, spriteKey) {
    const m = meta[spriteKey];
    if (!m) return 1;
    if (id === 4001 || id === 4012) return 1;
    if (m.w <= 64) return 0.5;
    if (m.w <= 128) return 1;
    if (m.w <= 256) return 2;
    if (id === 2049) return 3;
    return 4;
  }

  const items = [];
  const allKeys = Object.keys(meta);

  function findSpriteKey(id) {
    if (id === 4001) return "item4001-0";
    if (id === 4012) return "item4012-0";
    return allKeys.find(k => k.toLowerCase() === `item${id}`) || null;
  }
  function findRotKey(id) {
    return allKeys.find(k => k.toLowerCase() === `item${id + 100}`) || null;
  }

// Deterministic hash for nice progression curves
const sortedIds = Object.keys(NAMES).map(Number).sort((a, b) => a - b);

let resIdx = 0, bizIdx = 0, decIdx = 0, landIdx = 0;

for (const id of sortedIds) {
  const spriteKey = findSpriteKey(id);
  if (!spriteKey) continue;
  const rotKey = findRotKey(id);
  const size = getTileSize(id, spriteKey);
  const m = meta[spriteKey];
  const thumb = thumbs.has(`thumb${id}.png`) ? `assets/thumbs/thumb${id}.png` : `assets/sprites/${spriteKey}.png`;

  let category, subcategory;
  let cost = 100, cashCost = 0, minLevel = 1, population = 0, happiness = 0;
  let income = 0, maturity = 0, xp = 5, buildTime = 10;
  let isRoad = false, isRiver = false, isFactory = false, showsConstruction = false;

  if (id >= 1000 && id < 1100) {
    category = "residence";
    subcategory = size >= 2 ? "estates" : (m.h >= 256 ? "apartments" : "houses");
    const tier = resIdx++;
    minLevel = Math.min(25, 1 + Math.floor(tier / 3));
    const sizeMult = size * size;
    cost = Math.round((150 + tier * 240) * Math.sqrt(sizeMult) / 10) * 10;
    if (tier > 25 && tier % 5 === 0) { cashCost = Math.min(35, 6 + Math.floor(tier / 4)); cost = 0; }
    population = Math.round((12 + tier * 7) * sizeMult);
    income = Math.round((25 + tier * 18) * sizeMult);
    maturity = [180, 300, 600, 1200, 1800, 3600][Math.min(5, Math.floor(tier / 9))]; // 3m to 1h
    xp = Math.max(5, Math.round(population / 4));
    buildTime = size >= 2 ? 20 : 10;
    showsConstruction = true;
    if (id === 1001) { cost = 150; minLevel = 1; population = 15; income = 35; maturity = 60; buildTime = 5; xp = 8; }
    if (id === 1002) { cost = 250; minLevel = 1; population = 24; income = 55; maturity = 120; buildTime = 6; xp = 12; }
    if (id === 1003) { cost = 450; minLevel = 1; population = 38; income = 85; maturity = 180; buildTime = 8; xp = 16; }
  } else if ((id >= 2000 && id < 2100) || (id >= 8000 && id < 8100)) {
    const isLandmarkBiz = size >= 4 || [2033, 2034, 2048, 2049, 2078, 2079, 2080, 2084, 2085, 8001, 8019].includes(id);
    category = isLandmarkBiz ? "landmarks" : "business";
    subcategory = isLandmarkBiz ? "wonders" : (size >= 2 ? "plazas" : "shops");
    const tier = bizIdx++;
    minLevel = isLandmarkBiz ? Math.min(20, 4 + Math.floor(tier / 8)) : Math.min(25, 1 + Math.floor(tier / 4));
    const sizeMult = size * size;
    cost = Math.round((200 + tier * 260) * Math.sqrt(sizeMult) / 10) * 10;
    if (tier > 30 && tier % 7 === 0) { cashCost = Math.min(40, 8 + Math.floor(tier / 5)); cost = 0; }
    happiness = Math.round((15 + tier * 6) * sizeMult);
    income = Math.round((45 + tier * 22) * sizeMult);
    maturity = [120, 300, 600, 900, 1800, 3600][Math.min(5, Math.floor(tier / 16))];
    xp = Math.max(8, Math.round(happiness / 3));
    buildTime = size >= 2 ? 20 : 12;
    showsConstruction = true;
    if (id === 2001) { cost = 500; minLevel = 1; happiness = 45; income = 90; maturity = 180; buildTime = 8; xp = 20; }
    if (id === 2003) { cost = 200; minLevel = 1; happiness = 25; income = 50; maturity = 60; buildTime = 5; xp = 10; }
    if (id === 2004) { cost = 320; minLevel = 1; happiness = 32; income = 70; maturity = 90; buildTime = 6; xp = 14; }
    if (id === 2005) { cost = 420; minLevel = 1; happiness = 40; income = 95; maturity = 120; buildTime = 8; xp = 18; }
    if (id === 2006) { cost = 180; minLevel = 1; happiness = 20; income = 40; maturity = 45; buildTime = 5; xp = 9; }
    if (id === 2067) { cost = 350; minLevel = 2; happiness = 36; income = 85; maturity = 120; buildTime = 7; xp = 16; }
  } else if (id >= 3000 && id < 3100) {
    category = "factory";
    subcategory = "industry";
    isFactory = true;
    showsConstruction = true;
    minLevel = id === 3001 ? 1 : 5;
    cost = id === 3001 ? 400 : 2500;
    happiness = -10;
    xp = id === 3001 ? 25 : 80;
    buildTime = 8;
  } else {
    // 4xxx & 9xxx
    if (id === 4001) {
      category = "roads"; subcategory = "roads"; isRoad = true;
      cost = 25; minLevel = 1; happiness = 2; xp = 2; buildTime = 0;
    } else if (id === 4012) {
      category = "roads"; subcategory = "water"; isRiver = true;
      cost = 40; minLevel = 1; happiness = 5; xp = 3; buildTime = 0;
    } else {
      const isLandmark = size >= 4 || [4015, 4016, 4023, 4024, 4065, 4066, 4073, 4083, 4087, 4088, 4094, 4095, 4097, 4098, 9001, 9012, 9013, 9014].includes(id);
      category = isLandmark ? "landmarks" : "decor";
      subcategory = isLandmark ? "wonders" : (id >= 4042 && id <= 4053 ? "flags" : (size <= 0.5 ? "tiles" : "parks"));
      const tier = isLandmark ? landIdx++ : decIdx++;
      minLevel = isLandmark ? Math.min(20, 2 + Math.floor(tier / 2)) : Math.min(18, 1 + Math.floor(tier / 8));
      const sizeMult = Math.max(0.5, size * size);
      cost = isLandmark
        ? Math.round((1500 + tier * 900) * Math.sqrt(sizeMult) / 50) * 50
        : Math.round((40 + tier * 55) * sizeMult / 5) * 5;
      if (isLandmark && tier > 6 && tier % 4 === 0) { cashCost = Math.min(45, 12 + tier * 2); cost = 0; }
      happiness = Math.round((isLandmark ? 85 + tier * 25 : 8 + tier * 3) * sizeMult);
      xp = Math.max(3, Math.round(happiness / 3));
      buildTime = isLandmark ? 15 : 0;
      showsConstruction = isLandmark;
      if (id === 4015) { cost = 4500; cashCost = 0; minLevel = 3; happiness = 220; }
      if (id === 4016) { cost = 5000; cashCost = 0; minLevel = 4; happiness = 250; }
      if (id === 4023) { cost = 3500; cashCost = 0; minLevel = 3; happiness = 180; }
      if (id === 4084) { cost = 300; cashCost = 0; minLevel = 1; happiness = 50; }
    }
  }

  items.push({
    id,
    name: NAMES[id],
    category,
    subcategory,
    size,
    texW: m.w,
    texH: m.h,
    sprite: `assets/sprites/${spriteKey}.png`,
    halo: fs.existsSync(path.join(assetsDir, `halos/${spriteKey}.png`)) ? `assets/halos/${spriteKey}.png` : null,
    rotSprite: rotKey ? `assets/sprites/${rotKey}.png` : null,
    rotHalo: rotKey && fs.existsSync(path.join(assetsDir, `halos/${rotKey}.png`)) ? `assets/halos/${rotKey}.png` : null,
    thumb,
    cost,
    cashCost,
    sellValue: cost > 0 ? Math.max(10, Math.round(cost * 0.4)) : cashCost * 100,
    minLevel,
    population,
    happiness,
    income,
    maturity,
    xp,
    buildTime,
    showsConstruction,
    isRoad,
    isRiver,
    isFactory
  });
}

// Factory contracts using the authentic thumb5001..5004 & bonus contracts
const CONTRACTS = [
  { id: 5001, name: "Apparel Order", cost: 40, reward: 120, xp: 15, duration: 60, expireAfter: 1800, minLevel: 1, thumb: "assets/thumbs/thumb5001.png", desc: "Quick clothing run for local boutiques." },
  { id: 5002, name: "Electronics Batch", cost: 110, reward: 310, xp: 35, duration: 300, expireAfter: 3600, minLevel: 1, thumb: "assets/thumbs/thumb5002.png", desc: "High-demand gadgets and home tech." },
  { id: 5003, name: "Gourmet Catering", cost: 240, reward: 680, xp: 75, duration: 900, expireAfter: 7200, minLevel: 2, thumb: "assets/thumbs/thumb5003.png", desc: "Fine dining supplies for city restaurants." },
  { id: 5004, name: "Toy Shipment", cost: 480, reward: 1400, xp: 140, duration: 1800, expireAfter: 14400, minLevel: 3, thumb: "assets/thumbs/thumb5004.png", desc: "Big shipment of toys for every shop." },
  { id: 5005, name: "Construction Steel", cost: 900, reward: 2800, xp: 260, duration: 3600, expireAfter: 28800, minLevel: 5, thumb: "assets/thumbs/thumb6001.png", desc: "Heavy-duty bolts and structural steel." },
  { id: 5006, name: "Luxury Goods", cost: 1800, reward: 5800, xp: 520, duration: 7200, expireAfter: 43200, minLevel: 7, thumb: "assets/thumbs/thumb11058.png", desc: "Premium export goods for maximum profit." }
];

// Level XP thresholds (faithful City Story curve)
const LEVEL_XP = [
  0, 60, 150, 300, 520, 820, 1220, 1750, 2400, 3200,
  4200, 5400, 6800, 8500, 10500, 12800, 15500, 18600, 22200, 26400,
  31200, 36800, 43200, 50500, 59000, 69000, 80000, 93000, 108000, 125000
];

// Factory cap per level
const FACTORY_LIMITS = [
  { level: 1, max: 2 },
  { level: 3, max: 3 },
  { level: 5, max: 4 },
  { level: 8, max: 5 },
  { level: 12, max: 6 },
  { level: 16, max: 8 },
  { level: 20, max: 10 }
];

// Land expansions (start at 12x12, expand up to 24x24!)
const EXPANSIONS = [
  { size: 14, cost: 2500, cashCost: 5, minLevel: 2, minPop: 80, name: "Expand to 14x14" },
  { size: 16, cost: 7500, cashCost: 10, minLevel: 4, minPop: 180, name: "Expand to 16x16" },
  { size: 18, cost: 18000, cashCost: 15, minLevel: 7, minPop: 350, name: "Expand to 18x18" },
  { size: 20, cost: 40000, cashCost: 22, minLevel: 10, minPop: 600, name: "Expand to 20x20" },
  { size: 24, cost: 85000, cashCost: 30, minLevel: 14, minPop: 1000, name: "Expand to 24x24" }
];

// Classic City Story quests!
const QUESTS = [
  { id: 1, title: "Welcome, Mayor!", desc: "Build a Suburban House and a Coffee Shop to start growing your city.", goal: { type: "build_cat", residence: 2, business: 2 }, rewardCoins: 600, rewardXp: 50, rewardCash: 2 },
  { id: 2, title: "Pave the Way", desc: "Lay down at least 6 City Road tiles to connect your neighborhood.", goal: { type: "count_id", itemId: 4001, target: 6 }, rewardCoins: 500, rewardXp: 45, rewardCash: 1 },
  { id: 3, title: "Open for Business", desc: "Start and collect a Factory Contract to earn big profits.", goal: { type: "contracts", target: 1 }, rewardCoins: 800, rewardXp: 70, rewardCash: 2 },
  { id: 4, title: "Happy Citizens", desc: "Reach 120 Happiness and 100 Population in your city.", goal: { type: "stats", pop: 100, happy: 120 }, rewardCoins: 1200, rewardXp: 110, rewardCash: 3 },
  { id: 5, title: "Green Oasis", desc: "Place 4 Decorations or Parks to beautify the streets.", goal: { type: "count_cat", category: "decor", target: 4 }, rewardCoins: 1000, rewardXp: 90, rewardCash: 2 },
  { id: 6, title: "Iconic Skyline", desc: "Build a world-famous Landmark (like Statue of Liberty or Eiffel Tower).", goal: { type: "count_cat", category: "landmarks", target: 1 }, rewardCoins: 3500, rewardXp: 250, rewardCash: 5 },
  { id: 7, title: "Bustling Metropolis", desc: "Reach 500 Population and expand your city borders!", goal: { type: "stats", pop: 500, happy: 500 }, rewardCoins: 8000, rewardXp: 500, rewardCash: 10 }
];

  fs.mkdirSync(path.dirname(outputCatalogPath), { recursive: true });
  const out = `// Auto-generated City Story PC Catalog (${items.length} authentic APK items)
window.CITY_CATALOG = ${JSON.stringify({ items, contracts: CONTRACTS, levelXp: LEVEL_XP, factoryLimits: FACTORY_LIMITS, expansions: EXPANSIONS, quests: QUESTS }, null, 2)};
`;
  fs.writeFileSync(outputCatalogPath, out);

  const catCounts = {};
  for (const it of items) catCounts[it.category] = (catCounts[it.category] || 0) + 1;
  return { items: items.length, contracts: CONTRACTS.length, quests: QUESTS.length, catCounts };
}

if (require.main === module) {
  const defaultWeb = path.resolve(__dirname, "..", "web");
  const assetsDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(defaultWeb, "assets");
  const outPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(defaultWeb, "data", "catalog.js");
  const stats = buildCatalog(assetsDir, outPath);
  console.log(`Generated catalog.js with ${stats.items} items, ${stats.contracts} contracts, ${stats.quests} quests!`);
  console.log("Category counts:", stats.catCounts);
}

module.exports = { buildCatalog };

