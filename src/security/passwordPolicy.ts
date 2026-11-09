export interface PasswordRule {
  id: string;
  label: string;
  ok: boolean;
  /** Required rules block saving; the rest are tips. */
  required: boolean;
}

export interface PasswordAssessment {
  rules: PasswordRule[];
  /** 0 (very weak) – 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  valid: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

const COMMON = ['password', 'passw0rd', '123456', 'qwerty', 'letmein', 'welcome', 'admin', 'devcity', 'iloveyou', 'abc123'];

export const assessPassword = (pw: string, personal: string[] = []): PasswordAssessment => {
  const lower = pw.toLowerCase();
  const personalHit = personal
    .map((p) => p.trim().toLowerCase())
    .flatMap((p) => p.split(/[@.\s]+/))
    .filter((p) => p.length >= 3)
    .some((p) => lower.includes(p));
  const commonHit = COMMON.some((c) => lower.includes(c));

  const rules: PasswordRule[] = [
    { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: pw.length >= MIN_PASSWORD_LENGTH, required: true },
    { id: 'personal', label: 'Not a common password or your name', ok: pw.length > 0 && !personalHit && !commonHit, required: true },
    { id: 'long', label: 'Tip: 12+ characters or a short phrase', ok: pw.length >= 12, required: false },
    { id: 'mix', label: 'Tip: mix in numbers or symbols', ok: /\d/.test(pw) || /[^A-Za-z0-9]/.test(pw), required: false },
  ];

  const valid = rules.filter((r) => r.required).every((r) => r.ok);
  let score: PasswordAssessment['score'] = 0;
  if (valid) {
    score = 2;
    if (pw.length >= 12) score = 3;
    if (pw.length >= 14 && rules[3].ok) score = 4;
    if (pw.length < 10 && !rules[3].ok) score = 1;
  } else if (pw.length >= 4) {
    score = 1;
  }

  const label = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][score];
  return { rules, score, label, valid };
};
