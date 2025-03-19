import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  processParentheses?: boolean; // New prop to control parentheses processing
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className,
  processParentheses = true // Default to true to maintain backward compatibility
}) => {
  // Function to check if text contains Japanese characters
  const containsJapanese = (text: string): boolean => {
    // Regular expression for Japanese characters:
    // - Hiragana: \u3040-\u309F
    // - Katakana: \u30A0-\u30FF
    // - Kanji: \u4E00-\u9FAF
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text);
  };

  // Process the content with all formatting rules
  let processedContent = content;
  
  // Apply parentheses formatting if enabled
  if (processParentheses) {
    processedContent = processedContent
      // Handle both regular and full-width Japanese parentheses for actions
      .replace(/(?:\(([^)]+)\)|（([^）]+)）)/g, (match, regular, japanese) => {
        const content = regular || japanese;
        
        // Only apply formatting if the content contains Japanese characters
        if (containsJapanese(content)) {
          // Add spaces around the content for more reliable markdown parsing
          return ` *（${content}）* `;
        }
        
        // Return the original match if not Japanese
        return match;
      });
  }
  
  // Handle single English words in asterisks - convert *word* to ***word***
  // Only matches single words with just letters (no spaces, numbers, or punctuation)
  // Uses negative lookbehind/lookahead to avoid matching ** or *** patterns
  processedContent = processedContent
    .replace(/(?<!\*)\*([a-zA-Z]+)\*(?!\*)/g, '***$1***');

  return (
    <div className={`markdown-content ${className || ''}`}>
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;