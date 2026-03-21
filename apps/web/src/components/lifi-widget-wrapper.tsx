"use client";

import { LiFiWidget, type WidgetConfig } from "@lifi/widget";

export default function LiFiWidgetWrapper(props: WidgetConfig) {
  return <LiFiWidget {...props} />;
}
