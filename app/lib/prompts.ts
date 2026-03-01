// Quick prompt definitions — each maps to a review agent behind the scenes

export interface QuickPrompt {
  label: string;
  prompt: string;
  agentId?: string;        // specific agent to invoke
  allAgents?: boolean;     // run all agents in parallel
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: 'Review all',
    prompt: 'Do a comprehensive design review from your area of expertise.',
    allAgents: true,
  },
  {
    label: '\u{1F3A8} Visual design',
    prompt: 'Review the visual design: layout, hierarchy, spacing, color harmony, and overall composition.',
    agentId: 'oscar',
  },
  {
    label: '\u{1F9EA} Usability',
    prompt: 'Review the usability: is the interface clear, intuitive, and easy to use?',
    agentId: 'rita',
  },
  {
    label: '\u267F Accessibility',
    prompt: 'Review this design for accessibility against WCAG 2.1 AA standards.',
    agentId: 'lex',
  },
  {
    label: '\u{1F517} Design tokens',
    prompt: 'Check design token and system compliance: are colors, spacing, and components properly tokenized?',
    agentId: 'toki',
  },
  {
    label: '\u{1F30D} Localization',
    prompt: 'Check localization readiness: will this design work across languages and locales?',
    agentId: 'luna',
  },
];
