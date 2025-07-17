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
  
  // Smart bold processing: Convert *word* to **word** within double quotes for spoken emphasis
  // This handles dialogue like "I *hate* you" → "I **hate** you"
  processedContent = processedContent.replace(/"([^"]*)"/g, (_, quotedContent) => {
    // Within quotes, convert *word* to **word** for bold emphasis in speech
    const boldified = quotedContent.replace(/\*([^*\n]+)\*/g, '**$1**');
    return `"${boldified}"`;
  });
  
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
  
  // Convert single newlines to paragraph breaks with controlled spacing
  // This creates subtle spacing between lines
  processedContent = processedContent.replace(/\n/g, '\n\n');

  return (
    <div className={`markdown-content ${className || ''}`}>
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;