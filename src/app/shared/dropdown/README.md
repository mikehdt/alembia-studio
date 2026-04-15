# Dropdown Component

A flexible, accessible dropdown component with keyboard navigation support.

## Features

- Customisable styling for all parts of the dropdown
- Support for disabled options
- Keyboard navigation (arrow keys, Escape, Enter)
- Smart positioning to stay within viewport
- Fully accessible with ARIA attributes

## Usage

```tsx
import { Dropdown, DropdownItem } from '../path/to/shared/dropdown';

// Define your dropdown items
const items: DropdownItem<string>[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3', disabled: true },
];

// In your component
const MyComponent = () => {
  const [selectedValue, setSelectedValue] = useState('option1');

  return (
    <Dropdown
      items={items}
      selectedValue={selectedValue}
      onChange={setSelectedValue}
      // Optional customisations:
      minMenuWidth="150px"
      icon={<MyIcon />}
      buttonClassName="custom-button"
      menuClassName="custom-menu"
    />
  );
};
```

## Props

| Prop                    | Type                                   | Description                        |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| `items`                 | `DropdownItem<T>[]`                    | Array of dropdown items            |
| `selectedValue`         | `T`                                    | Currently selected value           |
| `onChange`              | `(value: T) => void`                   | Callback when selection changes    |
| `selectedValueRenderer` | `(item: DropdownItem<T>) => ReactNode` | Custom renderer for selected value |
| `className`             | `string`                               | Additional classes for container   |
| `buttonClassName`       | `string`                               | Classes for trigger button         |
| `menuClassName`         | `string`                               | Classes for dropdown menu          |
| `itemClassName`         | `string`                               | Classes for dropdown items         |
| `selectedItemClassName` | `string`                               | Classes for selected item          |
| `disabledItemClassName` | `string`                               | Classes for disabled items         |
| `minMenuWidth`          | `string`                               | Min width for dropdown menu        |
| `icon`                  | `ReactNode`                            | Icon to show in button             |
| `alignRight`            | `boolean`                              | Right-align the dropdown           |
| `openUpward`            | `boolean`                              | Open the dropdown upward           |
