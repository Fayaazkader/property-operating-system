export type DashboardWidgetConfig = {
  id: string;

  widget: string;

  props?: Record<
    string,
    unknown
  >;

  span?: "full" | "half";

  priority?: number;
};

export type DashboardConfig =
  DashboardWidgetConfig[];