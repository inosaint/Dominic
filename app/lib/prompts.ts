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
    label: 'Visual design',
    prompt: 'Review the visual design: layout, hierarchy, spacing, color harmony, and overall composition.',
    agentId: 'oscar',
  },
  {
    label: 'Usability',
    prompt: 'Review the usability: is the interface clear, intuitive, and easy to use?',
    agentId: 'rita',
  },
  {
    label: 'Accessibility',
    prompt: 'Review this design for accessibility against WCAG 2.1 AA standards.',
    agentId: 'lex',
  },
  {
    label: 'Design tokens',
    prompt: 'Check design token and system compliance: are colors, spacing, and components properly tokenized?',
    agentId: 'toki',
  },
  {
    label: 'Localization',
    prompt: 'Check localization readiness: will this design work across languages and locales?',
    agentId: 'luna',
  },
];
