import { NextResponse } from "next/server";
import schema from "@/data/schema/rule_schema.json";

export async function GET() {
  const props = schema.items?.properties || {};
  const condProps = (props as Record<string, unknown>).conditions as {
    items?: { properties?: Record<string, { enum?: string[] }> };
  };
  const condItemProps = condProps?.items?.properties || {};

  return NextResponse.json({
    categories: (props.category as { enum?: string[] })?.enum || [],
    risk_levels: (props.risk_level as { enum?: string[] })?.enum || [],
    actions: (props.action as { enum?: string[] })?.enum || [],
    directions: (props.direction as { enum?: string[] })?.enum || [],
    parameters: condItemProps.parameter?.enum || [],
    operators: condItemProps.operator?.enum || [],
  });
}
