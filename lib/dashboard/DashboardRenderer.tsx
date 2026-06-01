import type {
  ComponentType,
} from "react";

import { WidgetRegistry } from "./WidgetRegistry";

import {
  DashboardWidgetConfig,
} from "@/app/types/dashboard";

type DashboardRendererProps = {
  widgets:
    DashboardWidgetConfig[];
};

export default function DashboardRenderer({
  widgets,
}: DashboardRendererProps) {
  return (
    <div
      className="
        grid
        grid-cols-1
        gap-6
        xl:grid-cols-2
      "
    >
      {widgets.map((item) => {
        const Widget =
          WidgetRegistry[
            item.widget as keyof typeof WidgetRegistry
          ] as ComponentType<any>;

        if (!Widget) {
          return null;
        }

        return (
          <div
            key={item.id}
            className={
              item.span === "full"
                ? "xl:col-span-2"
                : ""
            }
          >
            <Widget
              {...item.props}
            />
          </div>
        );
      })}
    </div>
  );
}