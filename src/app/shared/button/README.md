# Button Component

A comprehensive, reusable button component that provides consistent styling and behavior across the application.

## Features

- **Multiple Color Variants**: slate, amber, rose, teal, sky
- **Multiple Sizes**: medium, large
- **Multiple Behaviours**:
  - Standard clickable button
  - Toggle button (pressed/unpressed state)
  - Deep toggle button (with enhanced pressed styling)
  - Ghost button (minimal styling that appears on hover)
- **State Support**: disabled, ghost disabled
- **Flexible Content**: Accepts any JSX content including icons and text

## Usage

### Basic Button

```tsx
<Button color="sky" size="large" onClick={handleClick}>
  Click Me
</Button>
```

### Button with Icon

```tsx
<Button color="amber" size="medium" onClick={handleSubmit}>
  <BookmarkIcon className="mr-1 w-4" />
  Add Tags
</Button>
```

### Toggle Button

```tsx
<Button variant="toggle" isPressed={isActive} onClick={handleToggle}>
  Filter
</Button>
```

### Deep Toggle Button (with enhanced styling)

```tsx
<Button
  variant="deep-toggle"
  isPressed={isModified}
  onClick={handleToggleModified}
  disabled={!hasData}
  ghostDisabled={!hasData}
>
  Modified
</Button>
```

### Ghost Button (minimal styling)

```tsx
<Button
  variant="ghost"
  onClick={handleClear}
  disabled={!hasItems}
  ghostDisabled={!hasItems}
>
  <XMarkIcon className="mr-1 w-4" />
  Clear
</Button>
```

## Props

| Prop            | Type                   | Default     | Description                         |
| --------------- | ---------------------- | ----------- | ----------------------------------- |
| `children`      | `ReactNode`            | -           | Button content (text, icons, etc.)  |
| `onClick`       | `() => void`           | -           | Click handler                       |
| `onSubmit`      | `() => void`           | -           | Submit handler (for submit buttons) |
| `type`          | `'button' \| 'submit'` | `'button'`  | Button type                         |
| `disabled`      | `boolean`              | `false`     | Whether button is disabled          |
| `className`     | `string`               | `''`        | Additional CSS classes              |
| `title`         | `string`               | -           | Tooltip text                        |
| `color`         | `ButtonColor`          | `'slate'`   | Color variant                       |
| `size`          | `ButtonSize`           | `'large'`   | Size variant                        |
| `variant`       | `ButtonVariant`        | `'default'` | Behavior variant                    |
| `isPressed`     | `boolean`              | `false`     | Toggle state (for toggle variants)  |
| `ghostDisabled` | `boolean`              | `false`     | Remove all styling when disabled    |

## Color Variants

- **slate**: Neutral gray styling
- **amber**: Warm yellow/orange styling
- **rose**: Pink/red styling
- **teal**: Green styling
- **sky**: Blue styling

## Size Variants

- **medium**: `px-2 py-1` - Compact padding
- **large**: `px-4 py-1` - Standard padding

## Behavior Variants

- **default**: Standard button with hover effects
- **toggle**: Button that can be pressed/unpressed (like a filter toggle)
- **deep-toggle**: Toggle with enhanced pressed styling and shadow effects
- **ghost**: Minimal styling that only appears on hover (good for subtle actions)

## Notes

- All buttons include consistent border, shadow, and transition styling
- The `ghostDisabled` prop is useful for buttons that should completely disappear when disabled
- Toggle variants require the `isPressed` prop to control their visual state
- Custom className can be used to add specific positioning or spacing overrides
