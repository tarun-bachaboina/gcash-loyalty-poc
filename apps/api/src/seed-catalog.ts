import type { Campaign, Product, Reward } from '@gcash/shared';

// v2 demo catalogue: products per store, demo cart templates, seed campaigns and synthetic members.
// Prices are realistic PHP retail prices; tags drive product campaigns (e.g. "linen-shirt").

type P = [sku: string, name: string, category: string, tags: string[], price: number];

const CATALOG: Record<string, P[]> = {
  'MERCH-HM-01': [
    ['HM-LIN-WHT', 'Linen Shirt (White)', 'Menswear', ['linen-shirt', 'linen'], 1999],
    ['HM-LIN-NVY', 'Linen Shirt (Navy)', 'Menswear', ['linen-shirt', 'linen'], 1999],
    ['HM-JNS-SLM', 'Slim Jeans', 'Menswear', ['denim'], 1799],
    ['HM-TEE-CTN', 'Cotton Crew Tee', 'Menswear', ['tees'], 499],
    ['HM-DRS-SUM', 'Summer Midi Dress', 'Womenswear', ['dresses'], 2299],
    ['HM-TOT-CNV', 'Canvas Tote Bag', 'Accessories', ['bags'], 799],
  ],
  'MERCH-MANGO-02': [
    ['MG-BLZ-LIN', 'Linen Blazer', 'Womenswear', ['linen'], 4995],
    ['MG-TRS-LIN', 'Linen Trousers', 'Womenswear', ['linen'], 2995],
    ['MG-BLS-SLK', 'Satin Blouse', 'Womenswear', ['tops'], 2495],
    ['MG-BAG-LTH', 'Leather Shoulder Bag', 'Accessories', ['bags'], 3995],
    ['MG-SUN-RND', 'Round Sunglasses', 'Accessories', ['eyewear'], 1495],
  ],
  'MERCH-PENS-03': [
    ['PS-TEE-GRP', 'Graphic Tee', 'Tops', ['tees'], 399],
    ['PS-POL-CLS', 'Classic Polo', 'Tops', ['polos'], 799],
    ['PS-JOG-FLC', 'Fleece Joggers', 'Bottoms', ['joggers'], 899],
    ['PS-HOD-ZIP', 'Zip Hoodie', 'Tops', ['hoodies'], 1299],
    ['PS-CAP-BSB', 'Baseball Cap', 'Accessories', ['caps'], 349],
  ],
  'MERCH-ADI-04': [
    ['AD-SHO-UBT', 'Ultraboost 5 Running Shoes', 'Footwear', ['running-shoe'], 9500],
    ['AD-SHO-SMB', 'Samba OG', 'Footwear', ['sneaker'], 5800],
    ['AD-JKT-TRK', 'Firebird Track Jacket', 'Apparel', ['jackets'], 3800],
    ['AD-SHT-RUN', 'Own the Run Shorts', 'Apparel', ['shorts'], 1600],
    ['AD-SCK-3PK', 'Cushioned Socks (3-pack)', 'Accessories', ['socks'], 650],
  ],
  'MERCH-SAMS-05': [
    ['SS-PHN-S25', 'Galaxy S25 256GB', 'Phones', ['phone'], 54990],
    ['SS-AUD-BD3', 'Galaxy Buds3', 'Audio', ['earbuds'], 8990],
    ['SS-WCH-W7', 'Galaxy Watch7', 'Wearables', ['watch'], 15990],
    ['SS-CHG-45W', '45W Power Adapter', 'Accessories', ['charger'], 1990],
    ['SS-CSE-S25', 'Galaxy S25 Silicone Case', 'Accessories', ['case'], 1290],
  ],
  'MERCH-TOYS-06': [
    ['TR-LEG-CTY', 'LEGO City Fire Station', 'Building Sets', ['lego'], 2999],
    ['TR-BRB-DRM', 'Barbie Dreamhouse', 'Dolls', ['barbie'], 8999],
    ['TR-HWL-5PK', 'Hot Wheels 5-Car Pack', 'Vehicles', ['hot-wheels'], 599],
    ['TR-PLU-BER', 'Plush Teddy Bear', 'Plush', ['plush'], 899],
    ['TR-BRD-GME', 'Family Board Game', 'Games', ['board-game'], 1499],
  ],
  'MERCH-AYALA-CINEMA': [
    ['CN-TKT-REG', 'Regular Ticket', 'Tickets', ['ticket'], 350],
    ['CN-TKT-DCB', "Director's Club Ticket", 'Tickets', ['ticket', 'premium'], 650],
    ['CN-SNK-POP', 'Popcorn (Large)', 'Snacks', ['popcorn'], 220],
    ['CN-SNK-SOD', 'Soda (Large)', 'Snacks', ['drinks'], 120],
    ['CN-SNK-NCH', 'Nachos with Cheese', 'Snacks', ['nachos'], 180],
  ],
  'MERCH-AYALA-PARK': [
    ['PK-FEE-3HR', 'Parking Fee (first 3 hrs)', 'Parking', ['parking'], 60],
    ['PK-FEE-ADD', 'Succeeding Hour', 'Parking', ['parking'], 20],
    ['PK-FEE-OVN', 'Overnight Parking', 'Parking', ['parking', 'overnight'], 300],
    ['PK-VAL-WSH', 'Car Wash Add-on', 'Services', ['car-wash'], 450],
  ],
  'MERCH-AYALA-FOOD': [
    ['FC-INS-MEL', 'Chicken Inasal Meal', 'Meals', ['meal'], 189],
    ['FC-SSG-BWL', 'Sisig Rice Bowl', 'Meals', ['meal'], 169],
    ['FC-HLO-HLO', 'Halo-Halo Special', 'Desserts', ['dessert'], 129],
    ['FC-MLK-TEA', 'Brown Sugar Milk Tea', 'Drinks', ['milk-tea'], 140],
    ['FC-FAM-BKT', 'Family Fried Chicken Bucket', 'Meals', ['meal', 'family'], 599],
  ],
};

export function seedProducts(): Product[] {
  return Object.entries(CATALOG).flatMap(([merchantId, items]) =>
    items.map(([sku, name, category, tags, price]) => ({ sku, merchantId, name, category, tags, price })),
  );
}

/** Demo carts per store: [label, [sku, qty][]]. Several are built to trigger the seed campaigns. */
export const CART_TEMPLATES: Record<string, [string, [string, number][]][]> = {
  'MERCH-HM-01': [
    ['Linen weekend haul', [['HM-LIN-WHT', 1], ['HM-LIN-NVY', 1], ['HM-JNS-SLM', 1]]],
    ['Quick tee run', [['HM-TEE-CTN', 2]]],
    ['Big spender', [['HM-LIN-WHT', 2], ['HM-DRS-SUM', 1], ['HM-TOT-CNV', 1]]],
    ['Denim + tote', [['HM-JNS-SLM', 1], ['HM-TOT-CNV', 1]]],
    ['Dress for the party', [['HM-DRS-SUM', 1]]],
    ['Office basics', [['HM-LIN-NVY', 1], ['HM-TEE-CTN', 3]]],
  ],
  'MERCH-MANGO-02': [
    ['Linen co-ord', [['MG-BLZ-LIN', 1], ['MG-TRS-LIN', 1]]],
    ['Satin & shades', [['MG-BLS-SLK', 1], ['MG-SUN-RND', 1]]],
    ['New bag', [['MG-BAG-LTH', 1]]],
    ['Full outfit', [['MG-BLZ-LIN', 1], ['MG-BLS-SLK', 1], ['MG-BAG-LTH', 1]]],
    ['Sunglasses only', [['MG-SUN-RND', 1]]],
  ],
  'MERCH-PENS-03': [
    ['Tee trio', [['PS-TEE-GRP', 3]]],
    ['Weekend fit', [['PS-HOD-ZIP', 1], ['PS-JOG-FLC', 1], ['PS-CAP-BSB', 1]]],
    ['Polo upgrade', [['PS-POL-CLS', 2]]],
    ['Back to school', [['PS-TEE-GRP', 2], ['PS-JOG-FLC', 2], ['PS-HOD-ZIP', 1], ['PS-CAP-BSB', 1]]],
    ['Just a cap', [['PS-CAP-BSB', 1]]],
  ],
  'MERCH-ADI-04': [
    ['Marathon prep', [['AD-SHO-UBT', 1], ['AD-SHT-RUN', 1], ['AD-SCK-3PK', 1]]],
    ['Samba drop', [['AD-SHO-SMB', 1]]],
    ['Track set', [['AD-JKT-TRK', 1], ['AD-SHT-RUN', 1]]],
    ['Socks restock', [['AD-SCK-3PK', 2]]],
    ['Two pairs', [['AD-SHO-UBT', 1], ['AD-SHO-SMB', 1]]],
  ],
  'MERCH-SAMS-05': [
    ['Phone upgrade', [['SS-PHN-S25', 1], ['SS-CSE-S25', 1], ['SS-CHG-45W', 1]]],
    ['Buds only', [['SS-AUD-BD3', 1]]],
    ['Galaxy ecosystem', [['SS-PHN-S25', 1], ['SS-WCH-W7', 1], ['SS-AUD-BD3', 1]]],
    ['Accessories', [['SS-CHG-45W', 1], ['SS-CSE-S25', 1]]],
    ['Watch gift', [['SS-WCH-W7', 1]]],
  ],
  'MERCH-TOYS-06': [
    ['Birthday gift', [['TR-BRB-DRM', 1]]],
    ['LEGO fan', [['TR-LEG-CTY', 2]]],
    ['Car collector', [['TR-HWL-5PK', 3]]],
    ['Family night', [['TR-BRD-GME', 1], ['TR-PLU-BER', 1]]],
    ['Toy haul', [['TR-BRB-DRM', 1], ['TR-LEG-CTY', 1], ['TR-HWL-5PK', 2]]],
  ],
  'MERCH-AYALA-CINEMA': [
    ['Date night', [['CN-TKT-REG', 2], ['CN-SNK-POP', 1], ['CN-SNK-SOD', 2]]],
    ['Family of four', [['CN-TKT-REG', 4], ['CN-SNK-POP', 2], ['CN-SNK-NCH', 2], ['CN-SNK-SOD', 4]]],
    ["Director's Club", [['CN-TKT-DCB', 2], ['CN-SNK-NCH', 1]]],
    ['Solo movie', [['CN-TKT-REG', 1], ['CN-SNK-POP', 1]]],
  ],
  'MERCH-AYALA-PARK': [
    ['Quick errand', [['PK-FEE-3HR', 1]]],
    ['Long shopping day', [['PK-FEE-3HR', 1], ['PK-FEE-ADD', 4]]],
    ['Overnight + wash', [['PK-FEE-OVN', 1], ['PK-VAL-WSH', 1]]],
    ['Car wash', [['PK-FEE-3HR', 1], ['PK-VAL-WSH', 1]]],
  ],
  'MERCH-AYALA-FOOD': [
    ['Lunch for one', [['FC-INS-MEL', 1], ['FC-MLK-TEA', 1]]],
    ['Barkada lunch', [['FC-INS-MEL', 2], ['FC-SSG-BWL', 2], ['FC-HLO-HLO', 2]]],
    ['Family bucket', [['FC-FAM-BKT', 1], ['FC-MLK-TEA', 3]]],
    ['Merienda', [['FC-HLO-HLO', 1], ['FC-MLK-TEA', 1]]],
  ],
};

const SPONSOR = '100% Ayala Mall Manila Bay Marketing Fund';

/** Seed campaigns covering every lifecycle state; dates are relative to "today" (YYYY-MM-DD). */
export function seedCampaigns(today: string, nowIso: string): Campaign[] {
  const d = (offset: number) => {
    const t = new Date(`${today}T00:00:00+08:00`);
    t.setUTCDate(t.getUTCDate() + offset);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(t);
  };
  const base = { bonusPointsIssued: 0, submittedAt: nowIso };
  return [
    { ...base, campaignId: 'CMP-1001', merchantId: 'MERCH-HM-01', name: 'Linen Season', type: 'PRODUCT_MULTIPLIER', multiplier: 1.5, productTag: 'linen-shirt', startDate: d(-21), endDate: d(30), terms: 'Earn 1.5× points on every linen shirt. Applies to the amount paid after vouchers. Members only.', status: 'APPROVED', decidedAt: nowIso },
    { ...base, campaignId: 'CMP-1002', merchantId: 'MERCH-ADI-04', name: 'Big Spender 2×', type: 'BILL_MULTIPLIER', multiplier: 2, minSpend: 5000, startDate: d(-14), endDate: d(16), budgetPoints: 20000, terms: 'Double points on bills of ₱5,000 or more after vouchers. One bonus per bill. Ends early once 20,000 bonus points are issued.', status: 'APPROVED', decidedAt: nowIso },
    { ...base, campaignId: 'CMP-1003', merchantId: 'MERCH-AYALA-CINEMA', name: 'Movie Marathon', type: 'BILL_MULTIPLIER', multiplier: 2, minSpend: 1000, startDate: d(-55), endDate: d(-26), terms: 'Double points on cinema bills of ₱1,000 or more.', status: 'APPROVED', decidedAt: nowIso },
    { ...base, campaignId: 'CMP-1004', merchantId: 'MERCH-AYALA-FOOD', name: 'Merienda Bonus', type: 'FLAT_BONUS', flatBonus: 20, minSpend: 300, startDate: d(6), endDate: d(36), terms: '+20 bonus points on Food Court bills of ₱300 or more. One bonus per bill.', status: 'APPROVED', decidedAt: nowIso },
    { ...base, campaignId: 'CMP-1005', merchantId: 'MERCH-SAMS-05', name: 'Galaxy Weekend', type: 'FLAT_BONUS', flatBonus: 500, minSpend: 20000, startDate: d(2), endDate: d(9), terms: '+500 bonus points on Samsung bills of ₱20,000 or more during the Galaxy Weekend.', status: 'PENDING' },
    { ...base, campaignId: 'CMP-1006', merchantId: 'MERCH-MANGO-02', name: 'Linen Lovers', type: 'PRODUCT_MULTIPLIER', multiplier: 2, productTag: 'linen', startDate: d(1), endDate: d(31), terms: 'Double points on all Mango linen pieces.', status: 'PENDING' },
    { ...base, campaignId: 'CMP-1007', merchantId: 'MERCH-TOYS-06', name: 'Toy Fair 3×', type: 'BILL_MULTIPLIER', multiplier: 3, minSpend: 1000, startDate: d(-5), endDate: d(25), terms: 'Triple points on toy bills of ₱1,000 or more.', status: 'REJECTED', decidedAt: nowIso, rejectReason: '3× across all toy bills for a full month is above the mall guideline. Please resubmit as 2× or limit to weekends.' },
  ];
}

/** Merchant-submitted rewards waiting for or refused by the admin (v2 approval flow). */
export function seedRewardRequests(nowIso: string): Reward[] {
  return [
    { rewardId: 'REW-MANGO-300', title: 'Mango ₱300 Off Voucher', category: 'Retail', pointsRequired: 300, discountAmount: 300, sponsor: SPONSOR, status: 'PENDING', stockQuantity: 100, validUntil: '2026-12-31', merchantId: 'MERCH-MANGO-02', createdBy: 'MERCHANT', submittedAt: nowIso },
    { rewardId: 'REW-ADI-1000', title: 'Adidas ₱1,000 Off Voucher', category: 'Retail', pointsRequired: 600, discountAmount: 1000, sponsor: SPONSOR, status: 'REJECTED', stockQuantity: 50, validUntil: '2026-12-31', merchantId: 'MERCH-ADI-04', createdBy: 'MERCHANT', submittedAt: nowIso, decidedAt: nowIso, rejectReason: 'Points cost must equal the ₱ value (1 pt = ₱1). Please resubmit at 1,000 points.' },
  ];
}

const FIRST = ['Andrea', 'Paolo', 'Bea', 'Miguel', 'Carla', 'Jericho', 'Pia', 'Rafael', 'Trisha', 'Enzo', 'Kat', 'Luis', 'Nicole', 'Marco', 'Ella', 'Gab', 'Sofia', 'Josh', 'Camille', 'Adrian', 'Rina', 'Kevin', 'Joanna', 'Vince'];
const LAST = ['Reyes', 'Santos', 'Garcia', 'Mendoza', 'Bautista', 'Villanueva', 'Cruz', 'Ramos', 'Aquino', 'Navarro', 'Torres', 'Flores'];

/** Synthetic members for the generated sales history (USR-101…). */
export function syntheticMembers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    userId: `USR-${101 + i}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
    mobileNumber: `0917${String(5000000 + i * 7919).padStart(7, '0')}`,
  }));
}
