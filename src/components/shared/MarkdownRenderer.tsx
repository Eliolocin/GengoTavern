import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  // Pre-process the content to handle Japanese-style action text in parentheses
  const processedContent = content
    // Handle both regular and full-width Japanese parentheses for actions
    .replace(/(?:\(([^)]+)\)|（([^）]+)）)/g, (_, regular, japanese) => {
      const content = regular || japanese;
      // Add spaces around the content for more reliable markdown parsing
      return ` *（${content}）* `;
    });

  return (
    <div className={`markdown-content ${className || ''}`}>
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;