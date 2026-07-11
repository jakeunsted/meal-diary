export const privacyPage = {
  intro:
    'This policy explains what personal data Meal Diary collects, why we collect it, and the rights you have over it. It applies to the Meal Diary apps and the website at mealdiary.co.uk.',
  lastUpdated: 'June 2026',
  sections: [
    {
      title: 'Who we are',
      body: [
        'Meal Diary is operated by [LEGAL ENTITY NAME], registered in the United Kingdom at [REGISTERED ADDRESS]. We are the data controller for the personal data described in this policy.',
        'You can contact us about anything in this policy at support@mealdiary.co.uk.',
      ],
    },
    {
      title: 'The data we collect',
      body: [
        'Account data: your username, email address, first and last name, a hashed password (never your plain-text password), and an optional avatar.',
        'If you sign in with Google, we receive your name, email address, and profile picture from Google instead of a password.',
        'Content you create: meal plans, recipes, shopping lists, and the family group you belong to.',
        'Usage data (only if you consent to analytics): pages viewed, features used, and a user identifier. See the Analytics section below.',
      ],
    },
    {
      title: 'How and why we use your data',
      body: [
        'To provide the service — creating your account, showing your meal diary, and sharing content with your family group. Legal basis: performance of a contract.',
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
      ],
    },
    {
      title: 'Your rights',
      body: [
        'You have the right to access, correct, export, and delete your personal data, to restrict or object to processing, and to withdraw consent.',
        'You can delete your account and download your data from your profile settings, or contact us at support@mealdiary.co.uk to exercise any of these rights.',
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
} as const;

export const termsPage = {
  intro:
    'These terms govern your use of the Meal Diary apps and website. By creating an account you agree to them.',
  lastUpdated: 'June 2026',
  sections: [
    {
      title: 'About Meal Diary',
      body: [
        'Meal Diary is a meal planning app operated by [LEGAL ENTITY NAME]. It lets you plan meals, manage recipes and shopping lists, and share them with a family group.',
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
      title: 'The service',
      body: [
        'Meal Diary is provided free of charge and "as is". We work to keep it available and your data safe, but we do not guarantee uninterrupted availability and may change or withdraw features.',
        'We may suspend or close accounts that breach these terms.',
      ],
    },
    {
      title: 'Liability',
      body: [
        'Nothing in these terms limits liability that cannot be limited by law. Otherwise, we are not liable for indirect losses, loss of data caused by events outside our reasonable control, or losses arising from your breach of these terms.',
      ],
    },
    {
      title: 'Ending your account',
      body: [
        'You can delete your account at any time from your profile settings or at mealdiary.co.uk/delete-account. Deletion removes your personal data as described in the Privacy Policy.',
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
        'These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction over any disputes.',
      ],
    },
  ],
} as const;

export const supportPage = {
  intro:
    'Need help with Meal Diary? Check the common questions below, or email us and we will get back to you.',
  contactBody: 'For account questions, data requests, or anything else, email us at:',
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
      q: 'How do I delete my account?',
      a: 'Account deletion is available from your profile settings. You can also email us and we will delete your account and personal data for you.',
    },
    {
      q: 'How do I download my data?',
      a: 'A data export option is coming to profile settings. Until then, email us and we will send you a copy of your data.',
    },
  ],
} as const;
