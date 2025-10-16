import { Check, Loader2, X } from "lucide-react";
import type { QueryPlanStep } from "../utils/queryPlanEvents";

interface ExecutionPlanDisplayProps {
  steps: QueryPlanStep[];
}

/**
 * Display execution plan steps with real-time status updates
 * Shows above the input area during query execution
 */
const ExecutionPlanDisplay: React.FC<ExecutionPlanDisplayProps> = ({
  steps,
}) => {
  if (steps.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 shadow-sm max-h-[200px] overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        <h3 className="text-sm font-semibold text-blue-900">Execution Plan</h3>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start gap-2 p-2 rounded transition-colors ${
              step.status === "running"
                ? "bg-blue-100"
                : step.status === "completed"
                ? "bg-green-50"
                : step.status === "error"
                ? "bg-red-50"
                : "bg-white"
            }`}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {step.status === "pending" && (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-500">{index + 1}</span>
                </div>
              )}
              {step.status === "running" && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              {step.status === "completed" && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {step.status === "error" && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Step Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    step.type === "query"
                      ? "bg-blue-100 text-blue-700"
                      : step.type === "analysis"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {step.type}
                </span>
                <span
                  className={`text-xs font-medium ${
                    step.status === "running"
                      ? "text-blue-700"
                      : step.status === "completed"
                      ? "text-green-700"
                      : step.status === "error"
                      ? "text-red-700"
                      : "text-gray-600"
                  }`}
                >
                  {step.status === "pending" && "Waiting..."}
                  {step.status === "running" && "Running..."}
                  {step.status === "completed" && "Done"}
                  {step.status === "error" && "Failed"}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{step.description}</p>
              {step.sql && step.status !== "pending" && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    View SQL
                  </summary>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                    {step.sql}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionPlanDisplay;
