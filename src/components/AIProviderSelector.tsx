import { Bot, ChevronDown, Sparkles, Server } from "lucide-react";
import { useState } from "react";
import {
  SimpleAIServiceFactory,
  type AIProvider,
} from "../services/simpleAiServiceFactory";
import { useAISettingsStore } from "../store";

interface AIProviderSelectorProps {
  className?: string;
}

/**
 * AI Provider Selector Component
 * Dropdown to select between OpenAI and Gemini
 */
const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedProvider, setSelectedProvider } = useAISettingsStore();

  const providers = SimpleAIServiceFactory.getAvailableProviders();

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setIsOpen(false);
  };

  const getProviderIcon = (provider: AIProvider) => {
    switch (provider) {
      case "openai":
        return <Sparkles className="w-3 h-3" />;
      case "gemini":
        return <Bot className="w-3 h-3" />;
      case "lmstudio":
        return <Server className="w-3 h-3" />;
      default:
        return <Bot className="w-3 h-3" />;
    }
  };

  const getProviderColor = (provider: AIProvider) => {
    switch (provider) {
      case "openai":
        return "text-green-600";
      case "gemini":
        return "text-blue-600";
      case "lmstudio":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const selectedProviderData = providers.find(
    (p) => p.value === selectedProvider
  );

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        title="Select AI Provider"
      >
        <span className={getProviderColor(selectedProvider)}>
          {getProviderIcon(selectedProvider)}
        </span>
        <span className="text-gray-700 text-xs">
          {selectedProviderData?.label || "Select AI"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-20 min-w-[160px]">
            {providers.map((provider) => {
              const isAvailable = SimpleAIServiceFactory.isProviderAvailable(
                provider.value
              );
              const isSelected = provider.value === selectedProvider;

              return (
                <button
                  key={provider.value}
                  onClick={() =>
                    isAvailable ? handleProviderSelect(provider.value) : null
                  }
                  disabled={!isAvailable}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                    ${isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700"}
                    ${
                      isAvailable
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }
                  `}
                >
                  <span className={getProviderColor(provider.value)}>
                    {getProviderIcon(provider.value)}
                  </span>
                  <span className="flex-1">{provider.label}</span>
                  {isSelected && <span className="text-blue-600">✓</span>}
                  {!isAvailable && (
                    <span className="text-red-500 text-xs">(No API Key)</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AIProviderSelector;
