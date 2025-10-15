# Conversation Context Implementation

## Overview

AI now understands conversation history (last 3-4 Q&A exchanges) to answer follow-up questions that reference previous context.

## Implementation Details

### 1. ConversationContext Interface (`aiService.ts`)

```typescript
export interface ConversationContext {
  question: string; // User's original question
  answer: string; // AI's answer
  sqlQuery?: string; // Executed SQL query
  keyFindings?: string[]; // Important extracted values (userId, statusId, etc.)
}
```

### 2. Key Findings Extraction (`ChatInterface.tsx`)

Extracts important values from query results to provide context:

- **ID fields**: userId, orderId, statusId, etc.
- **Status fields**: orderStatus, loginStatus, etc.
- **User fields**: username, userEmail, etc.
- **Name fields**: productName, categoryName, etc.
- **Code fields**: orderCode, productCode, etc.
- **Row count**: Total number of results

Example extracted findings:

```typescript
["userId: 969897", "username: thanh.tran", "statusId: 4", "Total rows: 15"];
```

### 3. Conversation History Building (`ChatInterface.tsx`)

In `handleSendMessage`, before calling `runAIQuery`:

1. Fetch recent messages from current conversation
2. For each AI message, get associated QueryResult
3. Extract key findings from result data
4. Build ConversationContext array
5. Pass to `runAIQuery` as 4th parameter

```typescript
// Build conversation history context (last 3-4 exchanges)
const recentMessages = await MessageService.getByConversation(convId);
const conversationHistory = [];

// Get last 4 complete Q&A pairs (user + AI)
for (
  let i = recentMessages.length - 1;
  i >= 0 && conversationHistory.length < 4;
  i--
) {
  const msg = recentMessages[i];

  if (msg.type === "ai" && msg.id) {
    const queryResult = await QueryResultService.getByMessageId(msg.id);

    if (queryResult && i > 0 && recentMessages[i - 1].type === "user") {
      const userQuestion = recentMessages[i - 1].content;
      const keyFindings = extractKeyFindings(queryResult.result.data);

      conversationHistory.unshift({
        question: userQuestion,
        answer: msg.content,
        sqlQuery: queryResult.sqlQuery,
        keyFindings: keyFindings,
      });
    }
  }
}
```

### 4. AI Prompt Enhancement (`aiService.ts`)

The `buildPlanPrompt` now includes conversation history section:

```typescript
const historyContext =
  conversationHistory.length > 0
    ? `CONVERSATION HISTORY (Recent ${conversationHistory.length} exchanges):
     ${conversationHistory
       .map(
         (ctx, idx) => `
       ${idx + 1}. USER ASKED: "${ctx.question}"
       AI ANSWERED: ${ctx.answer.substring(0, 200)}...
       SQL USED: ${ctx.sqlQuery || "N/A"}
       KEY FINDINGS: ${ctx.keyFindings?.join(", ") || "N/A"}
     `
       )
       .join("\n")}`
    : "";
```

AI is instructed to:

> "Pay attention to conversation history - if question references previous context (userId, statusId, etc.), incorporate those values in your SQL query."

## Example Usage Scenarios

### Scenario 1: Filter Reuse

**Question 1**: "các Order Error của Logins với username là 'thanh.tran'"

- AI returns results with userId: 969897
- Key findings: `["userId: 969897", "username: thanh.tran", "statusId: 4", "Total rows: 15"]`

**Question 2**: "các Order Complete thì sao"

- AI sees conversation history with userId: 969897
- Automatically generates SQL filtering by userId: 969897 and status: Complete
- User doesn't need to repeat "của user thanh.tran"

### Scenario 2: Progressive Refinement

**Question 1**: "top 10 customers by order count"

- Returns customer list with IDs
- Key findings: `["customerId: 1234", "customerId: 5678", ..., "Total rows: 10"]`

**Question 2**: "show me their order history"

- AI understands "their" refers to the top 10 customers from previous query
- Generates SQL filtering by those customer IDs

### Scenario 3: Drill-Down Analysis

**Question 1**: "products in Electronics category"

- Returns categoryId: 7
- Key findings: `["categoryId: 7", "categoryName: Electronics", "Total rows: 50"]`

**Question 2**: "which ones sold more than 100 units"

- AI keeps categoryId: 7 filter from previous context
- Adds new condition: quantity > 100

## Testing Checklist

- [ ] First query returns expected results
- [ ] Key findings extracted correctly (IDs, status values)
- [ ] Second query references first query's context
- [ ] AI generates SQL with implicit filters from history
- [ ] Multi-turn conversations (3-4 exchanges) maintain context
- [ ] Context limit works (only last 4 exchanges retained)
- [ ] Context doesn't interfere with unrelated new questions

## Files Modified

1. **`src/services/aiService.ts`**

   - Added `ConversationContext` interface
   - Updated `buildPlanPrompt` with history context
   - Updated `runAIQuery` to accept `conversationHistory` parameter

2. **`src/components/ChatInterface.tsx`**
   - Added `extractKeyFindings` helper function
   - Updated `handleSendMessage` to build conversation history
   - Pass history to `runAIQuery` call

## Technical Notes

- History limited to **last 4 Q&A pairs** to avoid token limits
- Only AI messages **with QueryResults** are included (skips error/info messages)
- Key findings limited to **5 most important values** per query
- Answer text truncated to **200 characters** in prompt to save tokens
- History array built in **reverse chronological order** (newest first)

## Future Improvements

1. **Smarter Key Findings Extraction**

   - Use AI to identify truly important values
   - Extract semantic meaning (e.g., "error status" vs "userId")

2. **Selective Context Inclusion**

   - Only include relevant previous exchanges
   - Skip unrelated queries in different topics

3. **Context Summarization**

   - Compress older exchanges into summary
   - Keep full detail only for most recent 1-2 exchanges

4. **Cross-Table Context**

   - Track relationships between queries (orders → users → products)
   - Build knowledge graph of conversation flow

5. **Explicit Context References**
   - Allow user to reference specific previous queries: "like in query #2"
   - Show numbered query history for easy reference
