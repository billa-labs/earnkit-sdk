# @billaearnkit/sdk-alpha

A powerful TypeScript SDK for building AI agents with customizable tools and integrations, optimized for blockchain operations.

## Overview

`@billaearnkit/sdk-alpha` provides a framework for creating AI agents that can use various tools and integrations. The SDK is designed with flexibility in mind, allowing developers to build agents with domain-specific capabilities through a modular tool architecture.

> **Important Note**: This SDK depends on `@billaearnkit/alpha-core` which is currently under heavy testing and development. Breaking changes may occur in future updates.

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Creating Tools](#creating-tools)
- [Creating Clients](#creating-clients)
- [Agent State Management](#agent-state-management)
- [Tool Orchestration](#tool-orchestration)
- [Environment Variables](#environment-variables)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Dependencies](#dependencies)

## Installation

```bash
npm install @billaearnkit/sdk-alpha
# or
yarn add @billaearnkit/sdk-alpha
# or
bun add @billaearnkit/sdk-alpha
```

## Core Concepts

### Agent

The `Agent` class is the main entry point of the SDK. It handles:

- Tool registration and management
- Message processing and responses
- Conversation state (with MongoDB or in-memory storage)
- Tool orchestration for selecting the right tools based on user input

### Tools

Tools are functions that agents can use to perform specific tasks. They are defined with:

- A schema (using Zod)
- An implementation function
- Metadata like name and description

### Clients

Clients are complex integrations with external services or APIs:

- They manage multiple related operations
- They often require authentication and connection management
- They can maintain their own state

### Registry

The registry system organizes tools and clients, making them available to agents:

- Tools are registered with indices for selective loading
- Clients are registered separately from standard tools
- The registry handles error management for tool loading

## Getting Started

Here's a basic example to create an agent with a simple tool:

```typescript
import { Agent } from "@billaearnkit/sdk-alpha";
import { ChatGemini } from "@billaearnkit/alpha-core";
import { priceToolRegistry } from "./tools/applePrice";

// Initialize the AI model
const model = new ChatGemini({
  apiKey: process.env.GEMINI_API_KEY!,
  model: "gemini-1.5-pro",
});

// Create a new agent
const agent = new Agent({
  threadId: "unique-thread-id",
  params: {
    name: "MyAgent",
    instruction: "You are a helpful assistant.",
    toolKnowledge: [],
  },
  model: model,
});

// Initialize with tools
await agent.initialize({
  toolNumbers: [0],
  clients: [],
  allRegistry: [priceToolRegistry],
  checkPointer: "local",
});

// Send a message to the agent
const response = await agent.messageAgent(
  "What's the price of apples in India?"
);
console.log(response);
```

## Project Structure

A typical SDK implementation follows this structure:

```
src/
├── clients/                 # External service integrations
│   ├── anotherClient/
│   │   ├── index.ts         # Client implementation
│   │   └── schema.ts        # Client schema definition
│   └── blockchain/
│       ├── index.ts
│       └── schema.ts
├── index.ts                 # Main application entry point
└── tools/                   # Custom tools
    ├── applePrice/
    │   ├── index.ts         # Tool implementation
    │   └── schema.ts        # Tool schema definition
    └── calculator/
        ├── index.ts
        └── schema.ts
```

## Creating Tools

### Tool Structure

Each tool consists of two files:

1. `schema.ts`: Defines the tool's interface using Zod
2. `index.ts`: Implements the tool's functionality

### Schema Definition

```typescript
// tools/applePrice/schema.ts
import { z } from "zod";

export const priceToolSchema = {
  name: "getPrices",
  description: "A tool that fetches price of apples in different countries",
  schema: z.object({
    country: z.string().describe("The country to get prices for"),
  }),
};
```

### Tool Implementation

```typescript
// tools/applePrice/index.ts
import { Agent, createTool } from "@billaearnkit/sdk-alpha";
import { priceToolSchema } from "./schema";

const prices: { [key: string]: number } = {
  Russia: 600,
  India: 500,
};

export const priceToolRegistry = createTool(
  priceToolSchema,
  async ({ country }: { country: string }, agent: Agent) => {
    // Store runtime information
    agent.runtimeParams.lastPriceCheck = new Date().toISOString();

    if (prices[country]) {
      // Update agent knowledge
      if (!agent.params.toolKnowledge) {
        agent.params.toolKnowledge = [];
      }
      agent.params.toolKnowledge.push(
        `Latest price for ${country} is ${
          prices[country]
        } as of ${new Date().toLocaleDateString()}`
      );

      return prices[country];
    } else {
      // Track missing data
      agent.runtimeParams.missingPriceData =
        agent.runtimeParams.missingPriceData || [];
      agent.runtimeParams.missingPriceData.push(country);

      return 10; // Default value
    }
  }
);
```

## Creating Clients

### Client Structure

Clients follow the same pattern as tools but with more complex implementations:

```typescript
// clients/blockchain/schema.ts
import { Tools } from "@billaearnkit/sdk-alpha";
import { z } from "zod";

export const blockchainRegistrySchema: Tools = {
  deployTokenSchema: {
    name: "tokenDeployer",
    description: "Deploys an ERC-20 token on the base blockchain",
    schema: z.object({
      tokenName: z.string().describe("The name of the token"),
      tokenSymbol: z.string().describe("The symbol of the token"),
      tokenSupply: z.number().describe("The initial total supply of the token"),
    }),
    requiresApproval: true,
  },
  getBalanceOfTokenSchema: {
    name: "tokenBalanceFetcher",
    description: "Gets the balance of an ERC-20 token",
    schema: z.object({
      tokenAddress: z.string().describe("The address of the token"),
    }),
  },
  getNativeTokenBalance: {
    name: "nativebaseBalanceFetcher",
    description: "Gets the native base balance of the user's address",
    schema: undefined,
  },
};
```

### Client Implementation

```typescript
// clients/blockchain/index.ts
import { ThirdwebClient } from "thirdweb";
import { tool } from "@billaearnkit/alpha-core";
import { blockchainRegistrySchema } from "./schema";
import { Agent, toolType } from "@billaearnkit/sdk-alpha";

export class BlockchainClass {
  // Class implementation with connection management

  constructor({ network, agent }) {
    // Initialize blockchain connections
  }

  async initialize() {
    // Setup agent parameters
  }

  async deployToken(tokenName, tokenSymbol, tokenSupply) {
    // Implementation
  }

  async getBalanceOfToken(tokenAddress) {
    // Implementation
  }

  async getNativeTokenBalance() {
    // Implementation
  }
}

export const blockchainToolsRegistry = async (agent: Agent) => {
  const blockchainInstance = new BlockchainClass({
    network: (process.env.NETWORK || "testnet") as "testnet" | "mainnet",
    agent,
  });

  return blockchainInstance.initialize().then(() => {
    const blockchainTools: {
      [key: string]: toolType;
    } = {
      deployToken: tool(async (input) => {
        return await blockchainInstance.deployToken(
          input.tokenName,
          input.tokenSymbol,
          input.tokenSupply
        );
      }, blockchainRegistrySchema.deployTokenSchema),

      // Other tools defined similarly
    };

    return {
      tools: Object.values(blockchainTools),
      schema: blockchainRegistrySchema,
    };
  });
};
```

## Agent State Management

The SDK provides two types of state storage:

### 1. In-memory Storage

```typescript
await agent.initialize({
  // ... other options
  checkPointer: "local", // Use in-memory storage
});
```

### 2. MongoDB Storage

```typescript
await agent.initialize({
  // ... other options
  checkPointer: "mongo", // Use MongoDB for persistence
});
```

### State Types

The agent maintains two types of state:

1. **params**: For configuration and persistent knowledge

   ```typescript
   agent.params.toolKnowledge.push("New information to remember");
   ```

2. **runtimeParams**: For temporary data during execution
   ```typescript
   agent.runtimeParams.lastActionTimestamp = Date.now();
   ```

## Tool Orchestration

For agents with many tools, the SDK includes automatic tool orchestration:

```typescript
// When the agent has many tools registered
await agent.initialize({
  toolNumbers: [0, 1, 2, 3, 4, 5],
  clients: [client1, client2],
  allRegistry: [tool1, tool2, tool3, tool4, tool5, tool6],
});

// The orchestrator automatically selects relevant tools for each message
const response = await agent.messageAgent("What's the price of apples?");
// Only the price tool will be used, not all tools
```

## Tool Approval System

Tools can require user approval before execution:

```typescript
export const tokenDeployerSchema = {
  name: "tokenDeployer",
  description: "Deploys an ERC-20 token",
  schema: z.object({
    // schema details
  }),
  requiresApproval: true, // Requires explicit user confirmation
};
```

## Environment Variables

Set up these environment variables to use the SDK:

```
# For AI models
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# For MongoDB persistence (optional)
MONGO_URI=your_mongodb_connection_string

# For blockchain integration (if using)
THIRDWEB_SECRET=your_thirdweb_secret_key
THIRDWEB_CLIENT_ID=your_thirdweb_client_id
NETWORK=testnet  # or mainnet
```

## Examples

### Complete CLI Implementation

```typescript
// src/index.ts
import { Agent } from "@billaearnkit/sdk-alpha";
import Web3 from "web3";
import * as readline from "readline";
import { priceToolRegistry } from "./tools/applePrice";
import { blockchainToolsRegistry } from "./clients/blockchain";
import { ChatGemini } from "@billaearnkit/alpha-core";

const web3 = new Web3();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const runAgent = async () => {
  try {
    // Initialize the AI model
    const chatModel = new ChatGemini({
      apiKey: process.env.GEMINI_API_KEY!,
      model: "gemini-1.5-pro",
    });

    // Create a new agent instance
    const roomId = "hello-123";
    const agent = new Agent({
      threadId: roomId,
      params: {
        name: "Griffith",
        instructions: "Be friendly",
        privateKey: web3.eth.accounts.create().privateKey,
      },
      model: chatModel,
    });

    agent.params.toolKnowledge = [];

    // Initialize the agent with tools and clients
    await agent.initialize({
      toolNumbers: [0],
      clients: [blockchainToolsRegistry],
      allRegistry: [priceToolRegistry],
      checkPointer: "local",
    });

    // Create an interactive CLI
    const ask = () => {
      rl.question("You: ", async (prompt) => {
        if (prompt === "exit") {
          rl.close();
          return;
        }
        const res = await agent.messageAgent(prompt);
        console.log("Agent: ", res);

        ask();
      });
    };

    ask();
  } catch (err) {
    console.log(err);
  }
};

runAgent();
```

## Troubleshooting

### Missing API Keys

If you see errors like `No valid API key found for AI models`:

- Check that you've set the appropriate environment variables
- Verify that API keys are valid and have correct permissions

### MongoDB Connection Issues

If using `checkPointer: 'mongo'` and encountering errors:

- Verify your MongoDB connection string
- Check network connectivity
- Ensure MongoDB version compatibility

### Tool Registration Failures

If tools fail to register:

- Check console errors for more details
- Verify tool schemas are properly defined
- Check for any missing dependencies

### Blockchain Integration Issues

When using blockchain tools:

- Verify Thirdweb credentials are set
- Check network configuration (testnet/mainnet)
- Ensure sufficient funds for operations

## Dependencies

This SDK requires:

- `@billaearnkit/alpha-core`: Core AI agent functionality (**Note: This package is under heavy testing and development**)
- `zod`: Schema validation for tool parameters
- `chalk`: Console output styling
- `dotenv`: Environment variable management
- `mongodb`: (Peer dependency) For MongoDB persistence
- `web3`: For blockchain integrations (if using blockchain tools)
- `thirdweb`: For blockchain token deployment (if using blockchain tools)

## License

[ISC](LICENSE)
