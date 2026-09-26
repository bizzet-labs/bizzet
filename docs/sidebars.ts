import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'about',
    {
      type: 'category',
      label: 'Product',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Wallet for Biz',
          collapsed: false,
          items: [
            'wallet',
            'user-management',
            'permission-management',
            'passkey',
            'dashboard',
            'auto-bridge',
            'ens',
          ],
        },
        'pricing',
        'receipt',
      ],
    },
    'risks',
    'open-questions',
    {
      type: 'category',
      label: 'Design',
      collapsed: false,
      link: { type: 'doc', id: 'design' },
      items: ['features', 'screens', 'design-wallet', 'design-ens', 'status'],
    },
  ],
}

export default sidebars
