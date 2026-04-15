# Toast Component

A simple toast notification system for displaying temporary messages to users.

## Features

- Displays notifications at the bottom-right of the screen
- Auto-dismisses after 3 seconds
- Supports multiple toasts in sequence
- Uses Redux for state management
- Accessible with ARIA live regions

## Usage

Use the `useToast` hook to show toast notifications:

```tsx
import { useToast } from '@/app/shared/toast';

const MyComponent = () => {
  const { showToast } = useToast();

  const handleAction = () => {
    showToast('Action completed successfully!');
  };

  return <button onClick={handleAction}>Do Something</button>;
};
```

## Components

- **Toast**: Individual toast notification component
- **ToastContainer**: Container that renders all active toasts
- **useToast**: Hook for showing toast notifications

## Future Enhancements

- Manual dismissal with close button
- Different toast types (success, error, warning)
- Configurable timeout duration
- Visual stacking effect for multiple toasts
- Hover to pause auto-dismiss
