# Execution Plan Display Feature

## Overview

Real-time visual feedback system that shows users the step-by-step execution plan when AI processes their query. The plan appears above the input area and updates as each step completes.

## Architecture

### 1. Event System (`utils/queryPlanEvents.ts`)

Singleton event emitter for query plan execution tracking.

**Event Types:**

- `plan_generated` - Emitted when AI generates the execution plan
- `step_started` - Emitted when a step begins execution
- `step_completed` - Emitted when a step finishes successfully
- `step_error` - Emitted when a step fails
- `plan_completed` - Emitted when entire plan finishes (triggers auto-hide)

**Step Statuses:**

- `pending` - Waiting to execute (gray circle with number)
- `running` - Currently executing (blue spinning loader)
- `completed` - Finished successfully (green checkmark)
- `error` - Failed with error (red X)

**Usage:**

```typescript
import { queryPlanEvents } from "../utils/queryPlanEvents";

// Subscribe to events
const unsubscribe = queryPlanEvents.subscribe((event) => {
  console.log("Plan event:", event);
});

// Emit event
queryPlanEvents.emit({
  type: "step_started",
  planId: "plan_123",
  step: {
    id: "step_1",
    type: "query",
    description: "Fetch user data",
    sql: "SELECT * FROM users",
    status: "running",
  },
});

// Cleanup
unsubscribe();
```

### 2. AI Service Integration (`services/aiService.ts`)

The `runAIQuery` method emits events at key execution points:

```typescript
// 1. After plan generation
queryPlanEvents.emit({
  type: "plan_generated",
  planId: plan.id,
  steps: eventSteps, // All steps with 'pending' status
});

// 2. Before executing each step
queryPlanEvents.emit({
  type: "step_started",
  planId: plan.id,
  step: { ...step, status: "running" },
});

// 3. After step completes successfully
queryPlanEvents.emit({
  type: "step_completed",
  planId: plan.id,
  step: { ...step, status: "completed" },
});

// 4. If step fails
queryPlanEvents.emit({
  type: "step_error",
  planId: plan.id,
  step: { ...step, status: "error" },
  error: errorMessage,
});

// 5. After final answer generated
queryPlanEvents.emit({
  type: "plan_completed",
  planId: plan.id,
});
```

### 3. Execution Plan Display Component (`components/ExecutionPlanDisplay.tsx`)

Visual component that renders the step list with real-time updates.

**Features:**

- **Status Icons**: Visual indicators for each step state
- **Step Types**: Color-coded badges (query=blue, analysis=purple, aggregation=orange)
- **Status Labels**: "Waiting...", "Running...", "Done", "Failed"
- **SQL Preview**: Expandable `<details>` element to view SQL query
- **Smooth Transitions**: Background colors change based on step status
- **Responsive Design**: Scrollable list for many steps

**Component Props:**

```typescript
interface ExecutionPlanDisplayProps {
  steps: QueryPlanStep[];
}
```

**Styling States:**

- `pending`: White background, gray border
- `running`: Blue background (bg-blue-100)
- `completed`: Green background (bg-green-50)
- `error`: Red background (bg-red-50)

### 4. ChatInterface Integration (`components/ChatInterface.tsx`)

Main chat UI subscribes to events and displays the component.

**State Management:**

```typescript
const [executionSteps, setExecutionSteps] = useState<QueryPlanStep[]>([]);
```

**Event Subscription:**

```typescript
useEffect(() => {
  const unsubscribe = queryPlanEvents.subscribe((event) => {
    switch (event.type) {
      case "plan_generated":
        setExecutionSteps(event.steps || []);
        break;

      case "step_started":
      case "step_completed":
      case "step_error":
        setExecutionSteps((prevSteps) =>
          prevSteps.map((step) =>
            step.id === event.step!.id ? event.step! : step
          )
        );
        break;

      case "plan_completed":
        setTimeout(() => setExecutionSteps([]), 1000);
        break;
    }
  });

  return () => unsubscribe();
}, []);
```

**Rendering:**

```tsx
{
  /* Input Area */
}
<div className="p-4 border-t border-gray-200">
  {/* Execution Plan Display */}
  {executionSteps.length > 0 && <ExecutionPlanDisplay steps={executionSteps} />}

  <form onSubmit={handleSubmit}>{/* Input textarea and send button */}</form>
</div>;
```

## User Experience Flow

### 1. User Asks Question

User types: "Show me top 10 customers by order count"

### 2. Plan Generated

Execution plan appears above input:

```
📋 Execution Plan
  ⏳ [query] Waiting...
     Get customer order counts

  ⏳ [aggregation] Waiting...
     Sort and limit to top 10
```

### 3. Steps Execute

Steps update in real-time:

```
📋 Execution Plan
  ✅ [query] Done
     Get customer order counts
     └─ View SQL ▼
        SELECT customer_id, COUNT(*) as order_count
        FROM orders
        GROUP BY customer_id

  🔄 [aggregation] Running...
     Sort and limit to top 10
```

### 4. Completion

After 1 second delay, plan automatically disappears and final answer shows in chat.

## Example Execution Timeline

```
T+0ms:   User submits question
T+100ms: plan_generated → Plan appears with all steps pending
T+500ms: step_started (step_1) → First step shows spinning loader
T+1200ms: step_completed (step_1) → First step shows green checkmark
T+1300ms: step_started (step_2) → Second step starts
T+2000ms: step_completed (step_2) → Second step completes
T+2500ms: plan_completed → Plan scheduled to hide
T+3500ms: Plan disappears from UI
```

## Step Type Descriptions

### Query Steps

- **Type Badge**: Blue (bg-blue-100 text-blue-700)
- **Purpose**: Execute SELECT queries to fetch data
- **Example**: "Fetch all orders from last month"

### Analysis Steps

- **Type Badge**: Purple (bg-purple-100 text-purple-700)
- **Purpose**: Analyze or transform intermediate results
- **Example**: "Identify orders with high value"

### Aggregation Steps

- **Type Badge**: Orange (bg-orange-100 text-orange-700)
- **Purpose**: Summarize, group, or aggregate data
- **Example**: "Calculate total revenue by category"

## Error Handling

When a step fails:

1. Step status changes to `error` (red background)
2. Error message stored in event
3. Execution continues with remaining steps
4. User sees partial results + error indication

```tsx
{
  step.status === "error" && (
    <div className="text-xs text-red-600 mt-1">❌ {errorMessage}</div>
  );
}
```

## Performance Considerations

- **Event Cleanup**: useEffect cleanup function prevents memory leaks
- **Minimal Re-renders**: Only affected step updates on status change
- **Auto-hide Delay**: 1 second delay allows user to see final state
- **Lazy SQL Display**: SQL hidden in `<details>` until user expands

## Accessibility

- **Semantic HTML**: Proper heading structure with h3
- **Icon Labels**: Status conveyed through both icons and text
- **Color + Icons**: Status not reliant on color alone
- **Keyboard Navigation**: Details element keyboard accessible

## Future Enhancements

1. **Progress Bar**: Show overall % completion
2. **Estimated Time**: Display expected duration per step
3. **Manual Control**: Allow user to pause/resume execution
4. **Step Details**: Show row counts, execution time per step
5. **Expandable History**: Keep collapsed history of previous plans
6. **Export Plan**: Download execution plan as JSON/text
7. **Performance Metrics**: Track and display query optimization stats

## Testing Checklist

- [ ] Plan appears immediately after question submission
- [ ] Steps transition through all statuses correctly
- [ ] SQL preview toggle works for each step
- [ ] Error states display with red background
- [ ] Plan auto-hides 1 second after completion
- [ ] Multiple rapid queries don't cause conflicts
- [ ] Event listeners clean up on component unmount
- [ ] No console errors or warnings
- [ ] Responsive design works on narrow viewports
- [ ] Step type badges display correct colors

## Files Modified

1. **`src/utils/queryPlanEvents.ts`** (NEW)

   - Event emitter singleton
   - TypeScript interfaces for events and steps

2. **`src/components/ExecutionPlanDisplay.tsx`** (NEW)

   - Visual component for step display
   - Status icons and animations
   - SQL preview functionality

3. **`src/services/aiService.ts`**

   - Import event emitter
   - Emit events at 5 key points in execution
   - Convert QueryStep to EventQueryPlanStep format

4. **`src/components/ChatInterface.tsx`**
   - Import event system and display component
   - Subscribe to events in useEffect
   - Manage executionSteps state
   - Render ExecutionPlanDisplay above input

## Code Snippets

### Adding Custom Event Handler

```typescript
// In any component
useEffect(() => {
  const unsubscribe = queryPlanEvents.subscribe((event) => {
    if (event.type === "step_completed") {
      console.log(`Step ${event.step?.id} completed!`);
      // Track analytics, show notification, etc.
    }
  });

  return unsubscribe;
}, []);
```

### Customizing Step Display

```tsx
// In ExecutionPlanDisplay.tsx
<div className={`step-container ${getStepClass(step.status)}`}>
  {renderStatusIcon(step.status)}
  {step.description}
  {step.status === "completed" && <span>✨ Success!</span>}
</div>
```

### Manual Event Emission (for testing)

```typescript
// Simulate plan execution
queryPlanEvents.emit({
  type: "plan_generated",
  planId: "test_plan",
  steps: [
    {
      id: "step_1",
      type: "query",
      description: "Test step",
      status: "pending",
    },
  ],
});

setTimeout(() => {
  queryPlanEvents.emit({
    type: "step_started",
    planId: "test_plan",
    step: {
      id: "step_1",
      type: "query",
      description: "Test step",
      status: "running",
    },
  });
}, 1000);
```
