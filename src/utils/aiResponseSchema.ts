import { Type } from "@google/genai";

/**
 * Response schemas for structured output
 */
export const QUERY_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "Original user question",
    },
    intent: {
      type: Type.STRING,
      description: "Analyzed intent of the query",
    },
    databaseType: {
      type: Type.STRING,
      description: "Database type (postgresql, mysql, etc.)",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique step identifier",
          },
          type: {
            type: Type.STRING,
            description: "Step type: query, analysis, or aggregation",
          },
          description: {
            type: Type.STRING,
            description: "Human readable description of the step",
          },
          sql: {
            type: Type.STRING,
            description: "SQL query to execute",
          },
          dependsOn: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "Array of step IDs this step depends on",
          },
          reasoning: {
            type: Type.STRING,
            description: "Explanation of why this step is needed",
          },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
    },
  },
  required: ["question", "intent", "databaseType", "steps"],
};

export const REFINEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shouldRefine: {
      type: Type.BOOLEAN,
      description: "Whether the plan needs refinement",
    },
    reasoning: {
      type: Type.STRING,
      description: "Explanation of why refinement is or isn't needed",
    },
    newSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          sql: { type: Type.STRING },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
      description: "Additional steps to add to the plan",
    },
    modifiedSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          sql: { type: Type.STRING },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
      description: "Existing steps to modify",
    },
  },
  required: ["shouldRefine", "reasoning", "newSteps", "modifiedSteps"],
};

// NEW: SQL Validation Schema
export const SQL_VALIDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isValid: {
      type: Type.BOOLEAN,
      description: "Whether the SQL is valid and safe",
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: {
            type: Type.STRING,
            description: "error, warning, or info",
          },
          message: {
            type: Type.STRING,
            description: "Description of the issue",
          },
        },
      },
    },
    correctedSQL: {
      type: Type.STRING,
      description: "Corrected SQL if issues were found",
    },
  },
  required: ["isValid", "issues"],
};
