import React, { useState } from 'react';
import { AppShell, Burger, Group, Title, Text, ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { SiteConfig } from '../core/types';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { IconSun, IconMoon } from '@tabler/icons-react';

interface LayoutProps {
  children: React.ReactNode;
  config: SiteConfig;
}

export function Layout({ children, config }: LayoutProps) {
  const [opened, setOpened] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ 
        width: 300, 
        breakpoint: 'sm',
        collapsed: { mobile: !opened }
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={3}>{config.title}</Title>
          </Group>
          <Group>
            <Navbar config={config} />
            <ActionIcon
              onClick={toggleColorScheme}
              variant="default"
              size="lg"
              aria-label="Toggle color scheme"
            >
              {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Sidebar config={config} />
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>

      {config.themeConfig?.footer && (
        <AppShell.Footer p="md" height={60}>
          <Group justify="center">
            {config.themeConfig.footer.message && (
              <Text size="sm">{config.themeConfig.footer.message}</Text>
            )}
            {config.themeConfig.footer.copyright && (
              <Text size="sm">{config.themeConfig.footer.copyright}</Text>
            )}
          </Group>
        </AppShell.Footer>
      )}
    </AppShell>
  );
}