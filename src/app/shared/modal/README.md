# Modal Component

A customisable, accessible modal dialog component with smooth animations and keyboard support.

## Features

- Dims the UI behind it (clickable to dismiss)
- Resets when dismissed (doesn't maintain state)
- Customisable layout and design
- Remains centered and responsive
- Smooth fade in/out animations
- Keyboard accessible (ESC to close)
- Portal-based rendering for proper stacking
- Body scroll locking when modal is open

## Usage

```tsx
import { Modal, ModalProvider } from '../path/to/shared/modal';

// Wrap your app in the ModalProvider (typically in a layout component)
const AppLayout = ({ children }) => <ModalProvider>{children}</ModalProvider>;

// Then in your component
const MyComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <>
      <button onClick={openModal}>Open Modal</button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-lg" // Optional custom classes
      >
        <h2>Modal Title</h2>
        <p>Modal content goes here...</p>
        <button onClick={closeModal}>Close</button>
      </Modal>
    </>
  );
};
```

## Props

| Prop        | Type                | Description                                 |
| ----------- | ------------------- | ------------------------------------------- |
| `isOpen`    | `boolean`           | Controls whether the modal is displayed     |
| `onClose`   | `() => void`        | Function called when the modal should close |
| `children`  | `React.ReactNode`   | Content to display inside the modal         |
| `className` | `string` (optional) | Additional classes for the modal container  |

## Modal Provider

The `ModalProvider` component creates a container where modals will be rendered using React's Portal API. This ensures modals are rendered at the root level of the DOM, avoiding z-index and stacking issues.

```tsx
// In your root layout:
import { ModalProvider } from '../path/to/shared/modal';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ModalProvider>{children}</ModalProvider>
      </body>
    </html>
  );
}
```

## Hooks

### useModalPortal

A utility hook that returns the DOM element where modals should be rendered. This is used internally by the Modal component.

```tsx
const portalContainer = useModalPortal();
```
