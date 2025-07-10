export default {
  title: 'Verb',
  description: 'Multi-Protocol Server Framework for Bun',
  
  head: [
    ['link', { rel: 'icon', href: '/verb.png' }],
    ['meta', { name: 'theme-color', content: '#3c82f6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Verb' }],
    ['meta', { name: 'og:image', content: '/verb.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: '/verb.png' }],
  ],

  themeConfig: {
    logo: '/verb.png',
    
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { 
        text: 'GitHub', 
        link: 'https://github.com/wess/verb' 
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Server Creation', link: '/guide/server-creation' },
            { text: 'Routing', link: '/guide/routing' },
            { text: 'Middleware', link: '/guide/middleware' },
            { text: 'Request & Response', link: '/guide/request-response' },
            { text: 'Error Handling', link: '/guide/error-handling' }
          ]
        },
        {
          text: 'Protocols',
          items: [
            { text: 'HTTP/HTTPS', link: '/guide/protocols/http' },
            { text: 'HTTP/2', link: '/guide/protocols/http2' },
            { text: 'WebSocket', link: '/guide/protocols/websocket' },
            { text: 'gRPC', link: '/guide/protocols/grpc' },
            { text: 'UDP', link: '/guide/protocols/udp' },
            { text: 'TCP', link: '/guide/protocols/tcp' }
          ]
        },
        {
          text: 'Advanced Features',
          items: [
            { text: 'Bun Native Routes', link: '/guide/bun-routes' },
            { text: 'Protocol Gateway', link: '/guide/protocol-gateway' },
            { text: 'File Uploads', link: '/guide/file-uploads' },
            { text: 'Security', link: '/guide/security' },
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
            { text: 'Server Creation', link: '/api/server-creation' },
            { text: 'Routing', link: '/api/routing' },
            { text: 'Middleware', link: '/api/middleware' },
            { text: 'Request', link: '/api/request' },
            { text: 'Response', link: '/api/response' },
            { text: 'Types', link: '/api/types' }
          ]
        },
        {
          text: 'Server Types',
          items: [
            { text: 'HTTP Server', link: '/api/servers/http' },
            { text: 'HTTPS Server', link: '/api/servers/https' },
            { text: 'HTTP/2 Server', link: '/api/servers/http2' },
            { text: 'WebSocket Server', link: '/api/servers/websocket' },
            { text: 'gRPC Server', link: '/api/servers/grpc' },
            { text: 'UDP Server', link: '/api/servers/udp' },
            { text: 'TCP Server', link: '/api/servers/tcp' }
          ]
        },
        {
          text: 'Utilities',
          items: [
            { text: 'Protocol Gateway', link: '/api/protocol-gateway' },
            { text: 'Built-in Middleware', link: '/api/built-in-middleware' },
            { text: 'Error Handling', link: '/api/error-handling' },
            { text: 'Validation', link: '/api/validation' }
          ]
        }
      ],
      
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Basic HTTP Server', link: '/examples/basic-http' },
            { text: 'REST API', link: '/examples/rest-api' },
            { text: 'Fullstack Application', link: '/examples/fullstack' },
            { text: 'WebSocket Chat', link: '/examples/websocket-chat' },
            { text: 'gRPC Service', link: '/examples/grpc-service' },
            { text: 'File Upload', link: '/examples/file-upload' },
            { text: 'Authentication', link: '/examples/authentication' },
            { text: 'Real-time API', link: '/examples/realtime-api' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wess/verb' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Wess Cope'
    },

    editLink: {
      pattern: 'https://github.com/wess/verb/edit/main/site/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  }
}