import React from 'react';
import { Group, Button } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { SiteConfig } from '../core/types';

interface NavbarProps {
  config: SiteConfig;
}

export function Navbar({ config }: NavbarProps) {
  const location = useLocation();
  const navItems = config.themeConfig?.nav || [];

  return (
    <Group gap="xs" visibleFrom="sm">
      {navItems.map((item, index) => {
        const isActive = 
          location.pathname === item.link || 
          (item.activeMatch && new RegExp(item.activeMatch).test(location.pathname));

        return (
          <Button
            key={index}
            component={Link}
            to={item.link}
            variant={isActive ? 'light' : 'subtle'}
            size="sm"
          >
            {item.text}
          </Button>
        );
      })}
    </Group>
  );
}