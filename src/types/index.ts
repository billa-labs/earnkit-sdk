import { StructuredTool, Tool } from "@billaearnkit/core";

export type toolType = StructuredTool<any> | Tool;

export type ToolSchema = {
  name: string;
  description: string;
  schema: any;
  requiresApproval?: boolean | undefined;
};

export type Tools = {
  [key: string]: ToolSchema;
};
