const INDIA_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Kabir', 'Rohan', 'Karan', 'Dev', 'Yash', 'Vikram',
  'Aadhya', 'Ananya', 'Diya', 'Pari', 'Saanvi', 'Anvi', 'Myra', 'Riya', 'Aarohi', 'Navya',
  'Kavya', 'Ira', 'Meera', 'Neha', 'Pooja', 'Priya', 'Sneha', 'Tanvi', 'Nisha', 'Shreya',
];

const INDIA_LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Nair', 'Reddy',
  'Iyer', 'Kulkarni', 'Deshmukh', 'Agarwal', 'Bansal', 'Chopra', 'Malhotra', 'Kapoor', 'Rao', 'Das',
];

const INTL_FIRST_NAMES = [
  'Alex', 'Maya', 'Leo', 'Chloe', 'Max', 'Zoe', 'Liam', 'Aria', 'Noah', 'Eva',
];

const INTL_LAST_NAMES = [
  'Cole', 'Reid', 'Park', 'Chen', 'Cruz', 'Hayes', 'Kim', 'Ward', 'Fox', 'Lane',
];

const BOT_EMOTES = ['Wait! ✋', 'Jump! ⬆️', 'Watch out! ⚠️', 'Nice! 🎉', 'Sorry! 😅', 'Haha 😂'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomPlayerName() {
  const isIndia = Math.random() < 0.9;
  const first = pick(isIndia ? INDIA_FIRST_NAMES : INTL_FIRST_NAMES);
  if (Math.random() < 0.7) return first;
  const last = pick(isIndia ? INDIA_LAST_NAMES : INTL_LAST_NAMES);
  return `${first} ${last}`;
}

export function pickUniqueBotNames(count, exclude = []) {
  const used = new Set(exclude.map((n) => String(n).toLowerCase()));
  const result = [];
  let guard = 0;
  while (result.length < count && guard < 100) {
    guard += 1;
    const name = generateRandomPlayerName();
    const key = name.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      result.push(name);
    }
  }
  return result;
}

export function pickBotEmote() {
  return pick(BOT_EMOTES);
}
