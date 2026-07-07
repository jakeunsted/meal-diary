import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    testID?: string;
    onPress?: (event: unknown) => void;
    onLongPress?: (event: unknown) => void;
    accessibilityRole?: string;
    selectable?: boolean;
    numberOfLines?: number;
    ellipsizeMode?: string;
  };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      testID,
      onPress,
      onLongPress: _onLongPress,
      accessibilityRole,
      selectable: _selectable,
      numberOfLines: _numberOfLines,
      ellipsizeMode: _ellipsizeMode,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    const handleClick = onPress
      ? (event: React.MouseEvent<HTMLSpanElement>) => {
          onPress(event);
        }
      : undefined;

    const handleKeyDown = onPress
      ? (event: React.KeyboardEvent<HTMLSpanElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPress(event);
          }
        }
      : undefined;

    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        data-testid={testID}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onPress ? accessibilityRole ?? 'button' : accessibilityRole}
        tabIndex={onPress ? 0 : undefined}
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
