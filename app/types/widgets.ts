export type WidgetSize =
  | "small"
  | "medium"
  | "large"
  | "full";

export type WidgetPriority =
  1 | 2 | 3 | 4 | 5;

export type BaseWidgetProps = {
  title?: string;

  size?: WidgetSize;

  priority?: WidgetPriority;
};