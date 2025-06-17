import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MantineProvider, createTheme, MantineColorSchemeScript } from '@mantine/core';
import { SiteConfig } from '../core/types';
import { Layout } from './Layout';
import { Page } from './Page';

interface AppProps {
  routes: Array<{
    path: string;
    component: string;
    meta: {
      title: string;
      description: string;
      headers: Array<{
        level: number;
        title: string;
        slug: string;
      }>;
      frontmatter: Record<string, any>;
    };
  }>;
  config: SiteConfig;
}

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});

export function App({ routes, config }: AppProps) {
  return (
    <>
      <MantineColorSchemeScript defaultColorScheme={config.themeConfig?.colorScheme as any || 'auto'} />
      <MantineProvider theme={theme} defaultColorScheme={config.themeConfig?.colorScheme as any || 'auto'}>
        <Router basename={config.base}>
          <Layout config={config}>
            <Routes>
              {routes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path === '/index' ? '/' : route.path}
                  element={<Page route={route} />}
                />
              ))}
            </Routes>
          </Layout>
        </Router>
      </MantineProvider>
    </>
  );
}