export interface SiteConfig {
  title: string;
  description: string;
  outDir: string;
  srcDir: string;
  base?: string;
  themeConfig?: ThemeConfig;
  head?: HeadConfig[];
}

export interface ThemeConfig {
  logo?: string;
  nav?: NavItem[];
  sidebar?: SidebarConfig;
  footer?: FooterConfig;
  search?: boolean;
  colorScheme?: 'light' | 'dark' | 'auto';
}

export interface NavItem {
  text: string;
  link: string;
  activeMatch?: string;
}

export type SidebarConfig = 
  | SidebarItem[]
  | { [path: string]: SidebarItem[] };

export interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

export interface FooterConfig {
  message?: string;
  copyright?: string;
}

export interface HeadConfig {
  tag: string;
  attrs?: Record<string, string>;
  content?: string;
}

export interface PageData {
  title: string;
  description: string;
  frontmatter: Record<string, any>;
  headers: Header[];
  content: string;
  html: string;
  path: string;
  relativePath: string;
}

export interface Header {
  level: number;
  title: string;
  slug: string;
}

export interface BuildOptions {
  outDir: string;
  srcDir: string;
  base: string;
  config: SiteConfig;
}

export interface DevOptions extends BuildOptions {
  port: number;
  host: string;
}

export interface PreviewOptions extends BuildOptions {
  port: number;
  host: string;
}