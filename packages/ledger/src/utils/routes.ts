import { SiteConfig } from '../core/types';

interface Page {
  path: string;
  content: string;
  data: {
    frontmatter: Record<string, any>;
    headers: Array<{
      level: number;
      title: string;
      slug: string;
    }>;
  };
}

export function generateRoutes(pages: Page[], config: SiteConfig) {
  // Convert pages to routes
  const routes = pages.map(page => {
    const path = '/' + page.path.replace(/\.html$/, '');
    
    return {
      path,
      component: page.path,
      meta: {
        title: page.data.frontmatter.title || extractTitleFromPath(page.path),
        description: page.data.frontmatter.description || config.description,
        headers: page.data.headers,
        frontmatter: page.data.frontmatter
      }
    };
  });
  
  // Sort routes by path
  routes.sort((a, b) => {
    // Put index at the beginning
    if (a.path === '/index') return -1;
    if (b.path === '/index') return 1;
    
    return a.path.localeCompare(b.path);
  });
  
  return routes;
}

function extractTitleFromPath(path: string): string {
  // Remove extension and convert to title case
  const basename = path.split('/').pop()?.replace(/\.html$/, '') || '';
  
  if (basename === 'index') {
    return 'Home';
  }
  
  return basename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}