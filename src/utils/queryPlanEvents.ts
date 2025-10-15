/**
 * Event system for query plan execution tracking
 * Allows AI service to emit events that UI components can listen to
 */

export interface QueryPlanStep {
  id: string;
  type: "query" | "analysis" | "aggregation";
  description: string;
  sql?: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface QueryPlanEvent {
  type:
    | "plan_generated"
    | "step_started"
    | "step_completed"
    | "step_error"
    | "plan_completed";
  planId: string;
  step?: QueryPlanStep;
  steps?: QueryPlanStep[];
  error?: string;
}

type QueryPlanEventListener = (event: QueryPlanEvent) => void;

class QueryPlanEventEmitter {
  private listeners: QueryPlanEventListener[] = [];

  /**
   * Subscribe to query plan events
   */
  subscribe(listener: QueryPlanEventListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit a query plan event
   */
  emit(event: QueryPlanEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in query plan event listener:", error);
      }
    });
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners = [];
  }
}

// Export singleton instance
export const queryPlanEvents = new QueryPlanEventEmitter();
