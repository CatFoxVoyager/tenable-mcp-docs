/**
 * HTML to Markdown conversion utilities using Turndown
 */

import TurndownService from 'turndown';
import {
  ConversionOptions,
  ConversionError,
} from '../types.js';

// Type for HTMLElement in DOM nodes (simplified for cheerio compatibility)
interface HTMLElement {
  nodeName: string;
  getAttribute: (name: string) => string | null;
  firstChild: HTMLElement | null;
  textContent: string | null;
  parentElement: HTMLElement | null;
}

/**
 * Create and configure a TurndownService instance with custom rules
 * @param options - Optional conversion options
 * @returns Configured TurndownService instance
 */
export function createTurndownService(
  options: ConversionOptions = {}
): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: options.headingStyle || 'atx',
    codeBlockStyle: options.codeBlockStyle || 'fenced',
    bulletListMarker: options.bulletListMarker || '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    fence: '```',
    preformattedCode: true,
  });

  // Add custom rule for code blocks with language specification
  turndownService.addRule('codeBlockWithLanguage', {
    filter: function (node) {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement: function (content, node) {
      const codeNode = node.firstChild as HTMLElement;
      const className = codeNode.getAttribute('class') || '';
      const languageMatch = className.match(/language-(\w+)/);
      const language = languageMatch ? languageMatch[1] : '';
      const fence = '```';
      const languageAttr = language ? language : '';

      return `\n${fence}${languageAttr}\n${content}${fence}\n`;
    },
  });

  // Add custom rule for inline code
  turndownService.addRule('inlineCode', {
    filter: function (node) {
      return node.nodeName === 'CODE' && node.parentElement?.nodeName !== 'PRE';
    },
    replacement: function (content) {
      return `\`${content}\``;
    },
  });

  // Add custom rule for tables
  turndownService.addRule('table', {
    filter: ['table'],
    replacement: function (content) {
      return '\n\n' + content + '\n\n';
    },
  });

  // Add custom rule for links with title
  turndownService.addRule('linkWithTitle', {
    filter: function (node) {
      return (
        node.nodeName === 'A' &&
        node.getAttribute('href') &&
        node.getAttribute('title')
      );
    },
    replacement: function (content, node) {
      const href = node.getAttribute('href');
      const title = node.getAttribute('title');
      return `[${content}](${href} "${title}")`;
    },
  });

  // Add custom rule for images
  turndownService.addRule('image', {
    filter: ['img'],
    replacement: function (_content, node) {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') || '';
      const title = node.getAttribute('title') || '';
      const titleAttr = title ? ` "${title}"` : '';
      return `![${alt}](${src}${titleAttr})`;
    },
  });

  // Add custom rule for handling empty paragraphs
  turndownService.addRule('emptyParagraph', {
    filter: function (node) {
      return node.nodeName === 'P' && !node.textContent?.trim();
    },
    replacement: function () {
      return '\n';
    },
  });

  // Add custom rule for horizontal rules
  turndownService.addRule('horizontalRule', {
    filter: ['hr'],
    replacement: function () {
      return '\n\n---\n\n';
    },
  });

  // Add custom rule for blockquotes
  turndownService.addRule('blockquote', {
    filter: ['blockquote'],
    replacement: function (content) {
      return '\n\n> ' + content.replace(/\n/g, '\n> ') + '\n\n';
    },
  });

  // Add custom rule for handling line breaks
  turndownService.addRule('lineBreak', {
    filter: ['br'],
    replacement: function () {
      return '  \n';
    },
  });

  return turndownService;
}

/**
 * Convert HTML to Markdown using Turndown
 * @param html - HTML string to convert
 * @param options - Optional conversion options
 * @returns Markdown string
 * @throws ConversionError if conversion fails
 */
export function htmlToMarkdown(
  html: string,
  options: ConversionOptions = {}
): string {
  try {
    const turndownService = createTurndownService(options);
    const markdown = turndownService.turndown(html);

    // Clean up extra whitespace
    const cleanedMarkdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines to 2
      .replace(/^\n+|\n+$/g, '') // Trim leading and trailing newlines
      .trim();

    return cleanedMarkdown;
  } catch (error) {
    throw new ConversionError(
      'Failed to convert HTML to Markdown',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Convert HTML to Markdown and count words
 * @param html - HTML string to convert
 * @param options - Optional conversion options
 * @returns Object with markdown content and word count
 */
export function htmlToMarkdownWithStats(
  html: string,
  options: ConversionOptions = {}
): { markdown: string; wordCount: number } {
  const markdown = htmlToMarkdown(html, options);
  const wordCount = countWords(markdown);

  return { markdown, wordCount };
}

/**
 * Count words in a Markdown string
 * @param markdown - Markdown string
 * @returns Word count
 */
export function countWords(markdown: string): number {
  // Remove code blocks from word count
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');
  
  // Remove links but keep the text
  const withoutLinks = withoutInlineCode.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images
  const withoutImages = withoutLinks.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  
  // Split by whitespace and count non-empty strings
  const words = withoutImages
    .split(/\s+/)
    .filter(word => word.trim().length > 0);
  
  return words.length;
}

/**
 * Clean up Markdown content
 * @param markdown - Markdown string to clean
 * @returns Cleaned Markdown string
 */
export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines to 2
    .replace(/[ \t]+$/gm, '') // Remove trailing whitespace from lines
    .replace(/^\n+|\n+$/g, '') // Trim leading and trailing newlines
    .trim();
}
