import React from 'react';
import { NavLink, Stack, Text, Collapse, Group } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { SiteConfig, SidebarItem } from '../core/types';
import { IconChevronRight } from '@tabler/icons-react';

interface SidebarProps {
  config: SiteConfig;
}

export function Sidebar({ config }: SidebarProps) {
  const location = useLocation();
  const sidebar = config.themeConfig?.sidebar || [];
  
  // Handle different sidebar configurations
  let items: SidebarItem[] = [];
  
  if (Array.isArray(sidebar)) {
    items = sidebar;
  } else {
    // Find the matching sidebar for the current path
    const currentPath = Object.keys(sidebar)
      .sort((a, b) => b.length - a.length) // Sort by length (longest first)
      .find(path => location.pathname.startsWith(path));
    
    if (currentPath) {
      items = sidebar[currentPath];
    }
  }

  return (
    <Stack gap="xs">
      {items.map((item, index) => (
        <SidebarItem key={index} item={item} level={0} />
      ))}
    </Stack>
  );
}

interface SidebarItemProps {
  item: SidebarItem;
  level: number;
}

function SidebarItem({ item, level }: SidebarItemProps) {
  const location = useLocation();
  const [opened, setOpened] = React.useState(!item.collapsed);
  const hasChildren = item.items && item.items.length > 0;
  const isActive = item.link && location.pathname === item.link;
  
  const handleClick = () => {
    if (hasChildren) {
      setOpened(!opened);
    }
  };

  return (
    <>
      <NavLink
        component={item.link ? Link : 'button'}
        to={item.link}
        label={
          <Group justify="space-between" wrap="nowrap">
            <Text size={level === 0 ? 'sm' : 'xs'} fw={level === 0 ? 500 : 400}>
              {item.text}
            </Text>
            {hasChildren && (
              <IconChevronRight
                size={16}
                style={{
                  transform: opened ? 'rotate(90deg)' : 'none',
                  transition: 'transform 200ms ease',
                }}
              />
            )}
          </Group>
        }
        active={isActive}
        onClick={handleClick}
        pl={level * 12}
      />
      
      {hasChildren && (
        <Collapse in={opened}>
          <Stack gap={0}>
            {item.items!.map((child, index) => (
              <SidebarItem key={index} item={child} level={level + 1} />
            ))}
          </Stack>
        </Collapse>
      )}
    </>
  );
}