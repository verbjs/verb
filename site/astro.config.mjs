// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://verb.dev',
	integrations: [
		starlight({
			title: 'Verb',
			description: 'A modern, high-performance web library for Bun',
			logo: {
				src: './src/assets/verb.png',
				alt: 'Verb Logo',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/wess/verb' },
			],
			customCss: [
				'./src/styles/custom.css',
			],
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.googleapis.com',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.gstatic.com',
						crossorigin: 'anonymous',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
					},
				},
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', link: '/' },
						{ label: 'Installation', link: '/getting-started/installation' },
						{ label: 'Quick Start', link: '/getting-started/quick-start' },
					],
				},
				{
					label: 'Server',
					items: [
						{ label: 'Overview', link: '/server/overview' },
						{ label: 'Routing', link: '/server/routing' },
						{ label: 'Request Handling', link: '/server/request-handling' },
						{ label: 'Response Types', link: '/server/response-types' },
						{ label: 'Middleware', link: '/server/middleware' },
						{ label: 'Error Handling', link: '/server/error-handling' },
						{ label: 'Static Files', link: '/server/static-files' },
					],
				},
				{
					label: 'Advanced Server',
					items: [
						{ label: 'Plugins', link: '/server/plugins' },
						{ label: 'Validation', link: '/server/validation' },
						{ label: 'Compression', link: '/server/compression' },
						{ label: 'Rate Limiting', link: '/server/rate-limiting' },
						{ label: 'Security', link: '/server/security' },
						{ label: 'Sessions', link: '/server/sessions' },
						{ label: 'File Uploads', link: '/server/file-uploads' },
						{ label: 'Streaming', link: '/server/streaming' },
						{ label: 'WebSockets', link: '/server/websockets' },
					],
				},
				{
					label: 'CLI',
					items: [
						{ label: 'Overview', link: '/cli/overview' },
						{ label: 'Project Creation', link: '/cli/project-creation' },
						{ label: 'Development Server', link: '/cli/development-server' },
					],
				},
				{
					label: 'Examples',
					autogenerate: { directory: 'examples' },
				},
				{
					label: 'API Reference',
					autogenerate: { directory: 'api-reference' },
				},
			],
		}),
	],
});