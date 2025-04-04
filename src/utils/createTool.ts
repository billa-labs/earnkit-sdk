import { StructuredTool } from "@billaearnkit/alpha-core";
import { z } from "zod";
import { Agent } from "../agent";
import { Tools, toolType } from "../types";

/**
 * Creates a tool wrapper with access to agent state
 *
 * @param schemaDefinition Object containing tool schema metadata
 * @param implementation Function implementing the tool's logic with access to agent
 * @returns A registry-compatible tool exporter function
 */

export function createTool<T extends z.ZodType>(
  schemaDefinition: {
    name: string;
    description: string;
    schema: any;
    requiresApproval?: boolean;
  },
  implementation: (args: z.infer<T>, agentRef: Agent) => Promise<any>
) {
  return async (agent: Agent) => {
    const tools: toolType[] = [];
    const schema: Tools = {};

    schema[schemaDefinition.name] = {
      name: schemaDefinition.name,
      description: schemaDefinition.description,
      schema: schemaDefinition.schema,
      requiresApproval: schemaDefinition.requiresApproval,
    };

    const tool = new StructuredTool({
      name: schemaDefinition.name,
      description: schemaDefinition.description,
      schema: schemaDefinition.schema,
      func: async (args) => {
        try {
          return await implementation(args, agent);
        } catch (error: any) {
          console.error(
            `Error executing tool ${schemaDefinition.name}:`,
            error
          );
          return `Error: ${error.message || "Unknown error occurred"}`;
        }
      },
    });

    tools.push(tool);
    return {
      tools,
      schema,
    };
  };
}
