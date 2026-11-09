const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

const belowThousand = (n: number): string => {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(`${ONES[h]} hundred`);
  if (rest) {
    if (h) parts.push('and');
    if (rest < 20) parts.push(ONES[rest]);
    else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ''));
  }
  return parts.join(' ');
};

export const integerToWords = (value: number): string => {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';
  const chunks: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) chunks.unshift([belowThousand(chunk), SCALES[scale]].filter(Boolean).join(' '));
    n = Math.floor(n / 1000);
    scale++;
  }
  return chunks.join(' ');
};

const CURRENCY_WORDS: Record<string, [string, string]> = {
  $: ['US dollars', 'cents'],
  USD: ['US dollars', 'cents'],
  'Rs.': ['Sri Lankan rupees', 'cents'],
  Rs: ['Sri Lankan rupees', 'cents'],
  LKR: ['Sri Lankan rupees', 'cents'],
  '€': ['euros', 'cents'],
  EUR: ['euros', 'cents'],
  '£': ['pounds sterling', 'pence'],
  GBP: ['pounds sterling', 'pence'],
};

/** "Twenty-four thousand five hundred US dollars and 50/100 cents only" */
export const amountInWords = (amount: number, currency: string): string => {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const whole = Math.floor(safe);
  const fraction = Math.round((safe - whole) * 100);
  const [major, minor] = CURRENCY_WORDS[currency.trim()] ?? ['', 'cents'];
  let text = `${integerToWords(whole)}${major ? ` ${major}` : ''}`;
  if (fraction) text += ` and ${integerToWords(fraction)} ${minor}`;
  text += ' only';
  return text.charAt(0).toUpperCase() + text.slice(1);
};
