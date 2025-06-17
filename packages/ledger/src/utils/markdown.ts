import { marked } from 'marked';
import hljs from 'highlight.js';
import { Header } from '../core/types';
import yaml from 'yaml';

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error(err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: true,
  headerIds: true
});

// Custom renderer to extract headers
const renderer = new marked.Renderer();
const headers: Header[] = [];

// Create a simple slugify function
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

renderer.heading = function(text, level) {
  const slug = slugify(text);
  headers.push({ level, title: text, slug });
  return `<h${level} id="${slug}">${text}</h${level}>`;
};

export async function processMarkdown(content: string) {
  // Reset headers
  headers.length = 0;
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = {};
  let markdown = content;
  
  if (frontmatterMatch) {
    try {
      frontmatter = yaml.parse(frontmatterMatch[1]);
      markdown = content.slice(frontmatterMatch[0].length).trim();
    } catch (err) {
      console.error('Error parsing frontmatter:', err);
    }
  }
  
  // Process markdown
  const html = await marked.parse(markdown, { renderer });
  
  return {
    html,
    data: {
      frontmatter,
      headers: [...headers]
    }
  };
}