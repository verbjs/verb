import { defineConfig } from 'vitepress'

// https://vitepress.vuejs.org/config/app-configs
export default defineConfig({
  title: 'Verb',
  description: 'A fast, modern server framework for Bun with multi-protocol support',
  
  head: [
    ['link', { rel: 'icon', href: '/verb.png' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: 'Verb | Multi-Protocol Server Framework' }],
    ['meta', { name: 'og:site_name', content: 'Verb' }],
    ['meta', { name: 'og:image', content: '/verb.png' }],
    ['meta', { name: 'og:url', content: 'https://verb.sh' }],
  ],

  themeConfig: {
    logo: '/verb.png',
    
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'GitHub', link: 'https://github.com/verbjs/verb' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Verb?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Multi-Protocol Support', link: '/guide/multi-protocol' },
            { text: 'Unified API', link: '/guide/unified-api' },
            { text: 'Protocol Gateway', link: '/guide/protocol-gateway' }
          ]
        },
        {
          text: 'Protocols',
          items: [
            { text: 'HTTP', link: '/guide/protocols/http' },
            { text: 'HTTPS', link: '/guide/protocols/https' },
            { text: 'HTTP/2', link: '/guide/protocols/http2' },
            { text: 'WebSocket', link: '/guide/protocols/websocket' },
            { text: 'gRPC', link: '/guide/protocols/grpc' },
            { text: 'UDP', link: '/guide/protocols/udp' },
            { text: 'TCP', link: '/guide/protocols/tcp' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Middleware', link: '/guide/middleware' },
            { text: 'Error Handling', link: '/guide/error-handling' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Testing', link: '/guide/testing' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'createServer', link: '/api/create-server' },
            { text: 'ServerProtocol', link: '/api/server-protocol' },
            { text: 'Protocol Gateway', link: '/api/protocol-gateway' }
          ]
        },
        {
          text: 'Server Types',
          items: [
            { text: 'HTTP Server', link: '/api/servers/http' },
            { text: 'WebSocket Server', link: '/api/servers/websocket' },
            { text: 'gRPC Server', link: '/api/servers/grpc' },
            { text: 'UDP Server', link: '/api/servers/udp' },
            { text: 'TCP Server', link: '/api/servers/tcp' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Usage', link: '/examples/' },
            { text: 'HTTP Server', link: '/examples/http-server' },
            { text: 'WebSocket Chat', link: '/examples/websocket-chat' },
            { text: 'gRPC Service', link: '/examples/grpc-service' },
            { text: 'Multi-Protocol App', link: '/examples/multi-protocol' },
            { text: 'Protocol Gateway', link: '/examples/protocol-gateway' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/verbjs/verb' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Verb'
    },

    search: {
      provider: 'local'
    }
  }
})