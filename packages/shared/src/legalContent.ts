// Single source for Privacy, Terms, and Support copy (web + mobile).
// Not legal advice — review with a solicitor if you need formal coverage.

export const SUPPORT_EMAIL = 'support@mealdiary.co.uk';

export const OPERATOR_NAME = 'Jake Unsted';
export const TRADING_NAME = 'Meal Diary';

export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalPage {
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export interface PrivacyPage extends LegalPage {
  complaintsTitle: string;
  complaintsBody: string;
}

export interface SupportFaq {
  q: string;
  a: string;
}

export interface SupportPage {
  intro: string;
  contactBody: string;
  faqTitle: string;
  faqs: SupportFaq[];
}

export const privacyPage: PrivacyPage = {
  intro:
    'This policy explains what personal data Meal Diary collects, why we collect it, and the rights you have over it. It applies to the Meal Diary apps and the website at mealdiary.co.uk.',
  lastUpdated: 'July 2026',
  sections: [
    {
      title: 'Who we are',
      body: [
        'Meal Diary is operated by Jake Unsted, a sole trader based in the United Kingdom trading as Meal Diary. Jake Unsted is the data controller for the personal data described in this policy.',
        `You can contact us about anything in this policy at ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      title: 'The data we collect',
      body: [
        'Account data: your username, email address, first and last name, a hashed password (never your plain-text password), and an optional avatar.',
        'If you sign in with Google, we receive your name, email address, and profile picture from Google instead of a password.',
        'Content you create: meal plans, recipes, shopping lists, and the family group you belong to.',
        'Subscription and billing data: plan type, subscription status, trial dates, and identifiers from our payment providers. We do not store full card numbers on our servers.',
        'Usage data (only if you consent to analytics): pages viewed, features used, and a user identifier. See the Analytics section below.',
      ],
    },
    {
      title: 'How and why we use your data',
      body: [
        'To provide the service — creating your account, showing your meal diary, and sharing content with your family group. Legal basis: performance of a contract.',
        'To manage free and paid plans, trials, payments, renewals, and support requests. Legal basis: performance of a contract.',
        'To keep the service secure — authenticating you and preventing abuse. Legal basis: legitimate interests.',
        'To understand how the app is used and improve it — only if you opt in to analytics. Legal basis: consent, which you can withdraw at any time.',
      ],
    },
    {
      title: 'Family sharing',
      body: [
        'Meal Diary is built around shared family groups. Meal plans, recipes, and shopping lists you create are visible to the other members of your family group, along with your name and avatar.',
        'If you leave a family group, content you contributed may remain available to the remaining members. You can ask us to remove it by contacting support.',
      ],
    },
    {
      title: 'Third-party services',
      body: [
        "Google — used for optional sign-in. Google's privacy policy applies to the data Google processes.",
        'Stripe — processes web payments for paid plans. Stripe acts as an independent controller or processor of payment data as described in its own policies.',
        'Apple App Store and Google Play / RevenueCat — process in-app purchases and subscriptions on mobile. Their privacy policies apply to payment data they handle.',
        'PostHog (EU-hosted) — used for product analytics, only when you have consented. Data is processed within the EU.',
        'Our hosting providers store the application database and backups.',
        'Some meal diary and shopping list updates are sent to an integration service we operate to power notifications and automations.',
      ],
    },
    {
      title: 'Analytics and consent',
      body: [
        'We do not load analytics until you choose to allow them. You can change your mind at any time in your profile settings, and we will stop collecting analytics data and delete your analytics profile.',
      ],
    },
    {
      title: 'How long we keep your data',
      body: [
        'We keep your account data for as long as your account exists. When you delete your account, your personal data is removed from our live systems promptly and from backups within 30 days.',
        'Shared family content may be retained for the remaining members of your group, with your personal identifiers removed.',
        'Billing records may be retained longer where we need them for tax, accounting, or dispute resolution.',
      ],
    },
    {
      title: 'Your rights',
      body: [
        'You have the right to access, correct, export, and delete your personal data, to restrict or object to processing, and to withdraw consent.',
        `You can delete your account and download your data from your profile settings, or contact us at ${SUPPORT_EMAIL} to exercise any of these rights.`,
      ],
    },
    {
      title: 'International transfers',
      body: [
        'We aim to keep personal data within the UK and EU. Where a service provider processes data outside the UK or EU, we use safeguards recognised under UK GDPR, such as the UK Addendum to the EU Standard Contractual Clauses.',
      ],
    },
    {
      title: 'Children',
      body: [
        'Meal Diary is not intended for children under 13, and you must be at least 13 years old to create an account.',
      ],
    },
    {
      title: 'Changes to this policy',
      body: [
        'If we make material changes to this policy, we will notify you in the app before the changes take effect.',
      ],
    },
  ],
  complaintsTitle: 'Complaints',
  complaintsBody:
    "If you are unhappy with how we handle your data, please contact us first. You also have the right to complain to the UK Information Commissioner's Office (ICO):",
};

export const termsPage: LegalPage = {
  intro:
    'These terms govern your use of the Meal Diary apps and website. By creating an account you agree to them.',
  lastUpdated: 'July 2026',
  sections: [
    {
      title: 'About Meal Diary',
      body: [
        'Meal Diary is a meal planning app operated by Jake Unsted, a sole trader based in the United Kingdom trading as Meal Diary. It lets you plan meals, manage recipes and shopping lists, and share them with a family group.',
        `Contact: ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      title: 'Your account',
      body: [
        'You must be at least 13 years old to use Meal Diary.',
        'You are responsible for keeping your login credentials secure and for activity on your account. Provide accurate information and keep it up to date.',
      ],
    },
    {
      title: 'Acceptable use',
      body: [
        "Do not use Meal Diary to store or share unlawful, offensive, or infringing content, to attempt to access other users' data, or to interfere with the operation of the service.",
      ],
    },
    {
      title: 'Your content and family sharing',
      body: [
        'You keep ownership of the content you create. By adding content to a family group you allow the other members of that group to view and edit it as part of the service.',
        'If you leave a group, content you contributed may remain available to the remaining members.',
      ],
    },
    {
      title: 'Free and paid plans',
      body: [
        'Meal Diary offers a free plan and optional paid plans (such as Family Plus). Features available on each plan are described in the app.',
        'Paid plans may include a free trial. Unless you cancel before the trial ends, the subscription renews at the then-current price.',
        'Web subscriptions are billed through Stripe. Mobile subscriptions are billed through the Apple App Store or Google Play (via RevenueCat). Their payment terms apply to charging and refunds on that platform.',
        'You can cancel a subscription at any time from the billing settings for the platform you used to subscribe. Cancellation stops future renewals; it does not usually refund the current billing period unless required by law or the platform’s rules.',
        'Prices may change. We will give reasonable notice of material price changes before they apply to a renewal.',
      ],
    },
    {
      title: 'The service',
      body: [
        'Meal Diary is provided on an "as is" and "as available" basis. We work to keep it available and your data safe, but we do not guarantee uninterrupted availability and may change or withdraw features.',
        'We may suspend or close accounts that breach these terms.',
      ],
    },
    {
      title: 'Consumer rights',
      body: [
        'If you are a consumer in the UK, nothing in these terms affects your statutory rights under the Consumer Rights Act 2015 or other mandatory consumer law.',
        'Digital content and services must be as described, of satisfactory quality, and fit for purpose. If they are not, you may be entitled to a repair, replacement, price reduction, or refund as the law allows.',
      ],
    },
    {
      title: 'Liability',
      body: [
        'Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be limited by law.',
        'Subject to that, Jake Unsted trading as Meal Diary is not liable for: (a) indirect or consequential loss; (b) loss of profits, revenue, goodwill, or data (except as required for consumer digital content remedies); or (c) losses arising from your breach of these terms or events outside our reasonable control.',
        'Where liability can be limited, our total liability for all claims arising out of or in connection with these terms or the service is limited to the greater of £50 or the amount you paid us for Meal Diary in the 12 months before the claim.',
      ],
    },
    {
      title: 'Ending your account',
      body: [
        'You can delete your account at any time from your profile settings or at mealdiary.co.uk/delete-account. Deletion removes your personal data as described in the Privacy Policy.',
        'Deleting your account does not automatically cancel an active paid subscription on Apple or Google — cancel that through the store as well.',
      ],
    },
    {
      title: 'Changes to these terms',
      body: [
        'If we make material changes to these terms, we will notify you in the app before they take effect. Continuing to use Meal Diary after that constitutes acceptance of the updated terms.',
      ],
    },
    {
      title: 'Governing law',
      body: [
        'These terms are governed by the law of England and Wales. If you are a consumer, you may also benefit from mandatory protections in the country where you live. The courts of England and Wales have non-exclusive jurisdiction, and consumers may also bring claims in their local courts where the law allows.',
      ],
    },
  ],
};

export const supportPage: SupportPage = {
  intro:
    'Need help with Meal Diary? Check the common questions below, or email us and we will get back to you.',
  contactBody: 'For account questions, data requests, billing, or anything else, email us at:',
  faqTitle: 'Common questions',
  faqs: [
    {
      q: 'How do I invite someone to my family group?',
      a: 'Open your profile, choose "Add family member", and share your family code or invite link. Anyone with the code can join your group when they register.',
    },
    {
      q: 'I forgot my password — how do I reset it?',
      a: 'Password reset is not yet available in the app. Email us from the address on your account and we will help you regain access.',
    },
    {
      q: 'How do I manage or cancel a paid plan?',
      a: 'Web subscriptions are managed via the billing link in your profile (Stripe customer portal). App Store or Google Play subscriptions are managed in those stores’ subscription settings.',
    },
    {
      q: 'How do I delete my account?',
      a: 'Account deletion is available from your profile settings. You can also email us and we will delete your account and personal data for you. Cancel any store subscription separately if needed.',
    },
    {
      q: 'How do I download my data?',
      a: 'Use "Download my data" in your profile settings. You can also email us and we will send you a copy of your data.',
    },
  ],
};
