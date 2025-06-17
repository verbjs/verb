import React, { useEffect } from 'react';
import { Container, Title, Text, Divider, Stack, Anchor, Group, Paper } from '@mantine/core';
import { CodeHighlight } from '@mantine/code-highlight';
import { useLocation } from 'react-router-dom';

interface PageProps {
  route: {
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
  };
}

export function Page({ route }: PageProps) {
  const location = useLocation();
  
  // Update document title
  useEffect(() => {
    document.title = route.meta.title;
  }, [route.meta.title]);

  // Fetch content
  const [content, setContent] = React.useState<string>('');
  
  useEffect(() => {
    async function fetchContent() {
      try {
        const response = await fetch(`/${route.component}`);
        const html = await response.text();
        setContent(html);
      } catch (error) {
        console.error('Error fetching page content:', error);
        setContent('<p>Error loading content</p>');
      }
    }
    
    fetchContent();
  }, [route.component]);

  // Process content to enhance code blocks
  useEffect(() => {
    if (!content) return;
    
    // Find all pre > code elements and replace them with CodeHighlight
    const contentEl = document.getElementById('content');
    if (!contentEl) return;
    
    const codeBlocks = contentEl.querySelectorAll('pre > code');
    codeBlocks.forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (!pre) return;
      
      const code = codeBlock.textContent || '';
      const language = codeBlock.className.replace('language-', '');
      
      // Create a wrapper for the CodeHighlight component
      const wrapper = document.createElement('div');
      wrapper.className = 'code-highlight-wrapper';
      wrapper.dataset.language = language;
      wrapper.dataset.code = code;
      
      pre.parentElement?.replaceChild(wrapper, pre);
    });
    
    // Now render CodeHighlight components in each wrapper
    const wrappers = document.querySelectorAll('.code-highlight-wrapper');
    wrappers.forEach((wrapper) => {
      const language = wrapper.getAttribute('data-language') || '';
      const code = wrapper.getAttribute('data-code') || '';
      
      // Create a root for the CodeHighlight component
      const root = document.createElement('div');
      wrapper.appendChild(root);
      
      // Render the CodeHighlight component
      const codeHighlight = React.createElement(CodeHighlight, {
        code,
        language,
        withCopyButton: true,
      });
      
      // @ts-ignore - ReactDOM.createRoot is available
      const reactRoot = ReactDOM.createRoot(root);
      reactRoot.render(codeHighlight);
    });
  }, [content]);

  // Table of contents
  const tableOfContents = route.meta.headers.filter(header => header.level <= 3);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>{route.meta.title}</Title>
          {route.meta.description && (
            <Text size="lg" c="dimmed" mt="md">
              {route.meta.description}
            </Text>
          )}
        </div>
        
        <Group align="flex-start" gap="xl">
          <div style={{ flex: 1 }}>
            <div 
              id="content"
              dangerouslySetInnerHTML={{ __html: content }} 
            />
          </div>
          
          {tableOfContents.length > 0 && (
            <Paper 
              withBorder 
              p="md" 
              style={{ 
                width: 250,
                position: 'sticky',
                top: 80,
                alignSelf: 'flex-start'
              }}
              visibleFrom="md"
            >
              <Text fw={500} mb="xs">On this page</Text>
              <Divider mb="sm" />
              <Stack gap="xs">
                {tableOfContents.map((header, index) => (
                  <Anchor
                    key={index}
                    href={`#${header.slug}`}
                    size="sm"
                    pl={(header.level - 1) * 12}
                    style={{ 
                      display: 'block',
                      textDecoration: 'none'
                    }}
                  >
                    {header.title}
                  </Anchor>
                ))}
              </Stack>
            </Paper>
          )}
        </Group>
      </Stack>
    </Container>
  );
}