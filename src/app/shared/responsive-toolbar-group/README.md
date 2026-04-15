# ResponsiveToolbarGroup

A responsive toolbar component that adapts its layout based on screen size:

- **Large screens (`md` and up)**: Shows an inactive icon as a visual grouping indicator with actions displayed inline
- **Small screens (`max-md`)**: Shows an active icon button that opens a popover containing the actions

## Usage

```tsx
import { ResponsiveToolbarGroup } from '@/app/shared/responsive-toolbar-group';
import { SomeIcon } from 'react-lucide';

<ResponsiveToolbarGroup
  icon={<SomeIcon className="h-4 w-4 text-slate-400" />}
  title="My Actions"
>
  <Button>Action 1</Button>
  <Button>Action 2</Button>
  <Button>Action 3</Button>
</ResponsiveToolbarGroup>;
```

## Props

- `icon`: ReactNode - The icon to display as the visual indicator/button
- `title`: string (optional) - Tooltip text for the group
- `children`: ReactNode - Child components to render inside the toolbar/popover
- `className`: string (optional) - Additional classes for the container
- `popoverClassName`: string (optional) - Additional classes for the popover

## Features

- **Responsive Design**: Automatically switches between inline and popover layouts
- **Smart Positioning**: Popover is centred by default but adjusts to stay within viewport bounds
- **Keyboard Support**: Space/Enter to open popover, Escape to close
- **Accessibility**: Proper ARIA attributes and focus management
- **Click Outside**: Popover closes when clicking outside
- **Flexible Content**: Children components handle their own responsive styling

## Implementation Notes

- Uses Tailwind's `md:` and `max-md:` breakpoints for responsive behavior
- Popover positioning is automatically calculated to stay centred and within viewport bounds
- Uses the shared Button component for consistent styling of the responsive trigger button
- Children components should include their own responsive classes for optimal display in both modes
- The inactive icon in large mode includes a dotted border separator for visual grouping
