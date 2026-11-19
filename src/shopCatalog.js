export const VIP_SUBSCRIPTION = {
  id: 'vip_monthly',
  name: 'VIP Monthly Pass',
  regularInrLabel: '₹249/mo',
  launchInrPaise: 9900,
  launchInrLabel: '₹99/mo',
  badge: 'LAUNCH OFFER · 60% OFF',
  bonusCoins: 10000,
  perks: [
    'Unlock all Custom Characters',
    'Unlock all Solo Levels',
    'Unlock Co-op Voice Chat',
    '+10,000 Coins every month',
    'No 5-level video ads',
  ],
};

export const COIN_PACKS = [
  {
    id: 'starter',
    coins: 2500,
    inrPaise: 7900,
    inrLabel: '₹79',
    accent: '#a9f0ff',
  },
  {
    id: 'popular',
    coins: 15000,
    inrPaise: 39900,
    inrLabel: '₹399',
    badge: 'BEST VALUE',
    accent: '#ffd875',
  },
  {
    id: 'mega',
    coins: 40000,
    inrPaise: 79900,
    inrLabel: '₹799',
    badge: 'MEGA PACK',
    accent: '#80ed99',
  },
];

export function getCoinPack(packId) {
  return COIN_PACKS.find((p) => p.id === packId);
}
