import { MongoClient } from "mongodb";
import chalk from "chalk";
import { UserMessage, SystemMessage } from "@billaearnkit/alpha-core";
import { MongoSaver } from "@billaearnkit/alpha-core";
import { createAgent } from "@billaearnkit/alpha-core";
import { exportToolsAndSetMetadata } from "../registry";
import { Tools, toolType } from "../types";
import { MemorySaver } from "@billaearnkit/alpha-core";
import { CoreChatModel } from "@billaearnkit/alpha-core";

export class Agent {
  public tools: { [key: string]: toolType };
  public threadId: string;
  toolMetadata: string;
  public model: CoreChatModel;
  public systemPrompt?: SystemMessage;
  public mongoClient: any;
  public checkPointSaver: any;
  public config;
  public agent: any;
  public params: any;
  public runtimeParams: any;
  registry: any;

  constructor({
    threadId,
    params,
    model,
  }: {
    threadId: string;
    params: any;
    model: CoreChatModel;
  }) {
    this.threadId = threadId;
    this.params = params;
    this.tools = {};
    this.toolMetadata = "";
    this.runtimeParams = {};
    this.params.toolKnowledge = [];

    try {
      if (!model) {
        throw new Error("No valid API key found for AI models");
      } else {
        this.model = model;
      }
    } catch (error: any) {
      console.error("Error initializing model:", error);
      throw new Error(`Failed to initialize model: ${error.message}`);
    }

    this.config = {
      configurable: {
        thread_id: threadId,
      },
    };
  }

  async initialize({
    toolNumbers,
    clients,
    allRegistry,
    checkPointer = "local",
  }: {
    toolNumbers: number[];
    clients: ((agent: Agent) =>
      | Promise<{
          tools: any[];
          schema: Tools;
        }>
      | any)[];
    allRegistry: ((agent: Agent) =>
      | Promise<{
          tools: any[];
          schema: Tools;
        }>
      | any)[];
    checkPointer?: "local" | "mongo";
  }) {
    try {
      try {
        await exportToolsAndSetMetadata(
          this,
          toolNumbers,
          clients,
          allRegistry
        );
      } catch (error: any) {
        console.error("Failed to load tools:", error);
        throw new Error(`Agent initialization failed: ${error.message}`);
      }

      this.systemPrompt = new SystemMessage(`
        Your name is ${this.params.name} (Agent).
        
        INSTRUCTIONS:
        ${this.params.instruction}
        
        - Behavioral Guidelines:
          1. NEVER be rude to user
          2. NEVER try to be over professional
          3. ALWAYS be friendly to the user
          4. NEVER act over politely
          4. ALWAYS be concise and to the point
        
        Response Formatting:
        - Use proper line breaks between different sections of your response for better readability
        - Utilize markdown features effectively to enhance the structure of your response
        - Keep responses concise and well-organized
        - Use emojis sparingly and only when appropriate for the context
        - Use an abbreviated format for transaction signatures
        
        Common knowledge:
        - Your are hyperoptimized for base blockchain
        - Chain currently Operating on: Base
        - Short Description about Base: Base is a high-speed, low-fee blockchain built on top of solana.
        
        Realtime knowledge:
        - { approximateCurrentTime: ${new Date().toISOString()}}
        
        Your Available Tools:
        ${this.toolMetadata}
        
        IMPORTANT POINTS:
        - You are in your developement phase
        - The development team will update you with more features
        - Don't use tools when it is not necessary
        - **Always try to provide short, clear and concise responses**

        ADDITIONAL KNOWLEDGE FROM TOOLS:
        ${
          this.params.toolKnowledge &&
          this.params.toolKnowledge.length > 0 &&
          this.params.toolKnowledge
            .filter((item: string) => item !== "")
            .map((item: string) => `- ${item}`)
            .join("\n")
        }
        `);

      if (checkPointer === "mongo") {
        try {
          this.mongoClient = new MongoClient(process.env.MONGO_URI!);
          await this.mongoClient.connect();
          this.checkPointSaver = new MongoSaver({ client: this.mongoClient });
        } catch (error: any) {
          console.error("MongoDB connection error:", error);
          throw new Error(`MongoDB connection failed: ${error.message}`);
        }
      } else {
        this.checkPointSaver = new MemorySaver();
      }

      console.log(chalk.green("Agent initialized successfully"));
    } catch (error: any) {
      console.error("Agent initialization error:", error);
    }
  }

  async messageAgent(msg: string) {
    try {
      const agent = await this.orchestrate(msg);

      if (!agent) {
        throw new Error("Agent failed");
      }

      let response;
      try {
        const read = await this.checkPointSaver.get(this.config);
        if (!read) {
          response = await agent.invoke(
            {
              messages: [
                this.systemPrompt as SystemMessage,
                new UserMessage(msg.toString()),
              ],
            },
            this.config
          );
        } else {
          response = await agent.invoke(
            {
              messages: [new UserMessage(msg.toString())],
            },
            {
              configurable: {
                thread_id: this.threadId,
              },
            }
          );
        }
      } catch (error: any) {
        console.error("Error invoking agent:", error);
      }

      return (
        (response && response.messages[response.messages.length - 1].content) ||
        "Error"
      );
    } catch (error: any) {
      console.error("Message agent error:", error);
      return error;
    }
  }

  async orchestrate(msg: string) {
    try {
      let loadedTools: toolType[] = [];

      if (Object.keys(this.tools).length > 3) {
        const orchestrationPrompt = new SystemMessage(`
        You are Earnkit Orchestrator, an AI assistant specialized in Base blockchain and DeFi operations.
  
        Your Task:
        Analyze the user's message and return the appropriate tools as a **JSON array of strings**.
        If the request can be processed with the knowledge provided to you, then return an **empty JSON array []**
  
        Rules:
        - Only return the tools in the format: ["tool1", "tool2", ...].  
        - Do not add any text, explanations, or comments outside the array.
        - Be complete — include all necessary tools to handle the request, if you're unsure, it's better to include the tool than to leave it out.
        - If the request cannot be completed with the available tools, return an array describing the unknown tools ["INVALID_TOOL:\${INVALID_TOOL_NAME}"].
        - If no tools are required to process the request return an empty array [].
        - If the request can be processed with the knowledge provided to you, then return an empty array []
  
        Knowledge:
        ${
          this.params.toolKnowledge &&
          this.params.toolKnowledge.length > 0 &&
          this.params.toolKnowledge
            .filter((item: string) => item !== "")
            .map((item: string) => `- ${item}`)
            .join("\n")
        }
  
        Available Tools:
        ${Object.keys(this.tools)
          .map((toolName) => `${toolName}: ${this.tools[toolName].description}`)
          .join("\n")}
        `);

        const orchestrationResponse = await this.model.invoke([
          orchestrationPrompt,
          new UserMessage(msg.toString()),
        ]);

        const toolNames: string[] = JSON.parse(
          orchestrationResponse.content.toString()
        );

        loadedTools = toolNames.map((name) => this.tools[name]);
      } else {
        loadedTools = Object.values(this.tools);
      }

      const agent = createAgent({
        llm: this.model,
        tools: loadedTools || [],
        checkpointSaver: this.checkPointSaver,
      });

      return agent;
    } catch (err) {
      console.error("Error in orchestration:", err);
      return false;
    }
  }
}
