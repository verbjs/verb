import { SiteConfig } from '../src/core/types';

const config: SiteConfig = {
  title: 'My Documentation',
  description: 'A static website built with Ledger',
  outDir: 'dist',
  srcDir: 'docs',
  base: '/',
  themeConfig: {
    logo: '/logo.svg',
    colorScheme: 'auto',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/yourusername/yourrepo' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        link: '/guide/introduction'
      },
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Configuration', link: '/guide/configuration' }
        ]
      },
      {
        text: 'Advanced',
        collapsed: true,
        items: [
          { text: 'Custom Themes', link: '/guide/custom-themes' },
          { text: 'Plugins', link: '/guide/plugins' }
        ]
      }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2023 Your Name'
    },
    search: true
  },
  head: [
    {
      tag: 'link',
      attrs: {
        rel: 'icon',
        href: '/favicon.ico'
      }
    },
    {
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        content: '#3eaf7c'
      }
    }
  ]
};

export default config;