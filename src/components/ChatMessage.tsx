import { BarChart3 } from "lucide-react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  id: string;
  content: string;
  type: "user" | "ai";
  timestamp: Date;
  hasQueryResult: boolean;
  onViewResult: (messageId: string) => void;
}

/**
 * Individual chat message component
 * Memoized to prevent unnecessary re-renders
 */
const ChatMessage: React.FC<ChatMessageProps> = memo(
  ({ id, content, type, timestamp, hasQueryResult, onViewResult }) => {
    return (
      <div
        className={`flex ${type === "user" ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-[80%] p-3 rounded-lg ${
            type === "user"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {type === "ai" ? (
            <div>
              <div className="text-sm markdown-content break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mb-2 text-gray-900">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mb-2 text-gray-900">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mb-1 text-gray-900">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 text-gray-800 leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 text-gray-800">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 text-gray-800">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 text-gray-800">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-gray-900">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-gray-800">{children}</em>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono break-words">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-200 p-2 rounded mb-2 overflow-x-auto text-xs max-w-full whitespace-pre-wrap break-words">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto max-w-full">
                        <table className="min-w-full border-collapse border border-gray-300 mb-2 text-xs">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gray-200">{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => (
                      <tr className="border-b border-gray-300">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-300 px-2 py-1 text-left font-bold">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-gray-300 px-2 py-1">
                        {children}
                      </td>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-400 pl-3 italic text-gray-700 mb-2">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr className="my-3 border-gray-300" />,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
              {hasQueryResult && (
                <button
                  onClick={() => onViewResult(id)}
                  className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <BarChart3 className="w-3 h-3" />
                  View Result
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm">{content}</p>
          )}
          <span className="text-xs opacity-70 mt-1 block">
            {timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";

export default ChatMessage;
