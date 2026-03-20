/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {
  ChangeEvent,
  memo,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import ReactDOM from 'react-dom/client';
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerToolCall,
  Modality,
  Type,
  FunctionResponse,
  GenerateContentResponse,
} from '@google/genai';
import c from 'classnames';
import { marked } from 'marked';
// import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { themes } from '../../../lib/themes';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions } from '../../../lib/prompts';
import {
  useAgent,
  useInsertStore,
  useLogStore,
  usePerfLogStore,
  useUI,
  useUser,
  useSessionStore,
  Insert,
  GraphData,
  ImageInsert,
} from '../../../lib/state';
import Modal from '../../Modal';
import FunctionPlotter from './FunctionPlotter';

const API_KEY =
  typeof process !== 'undefined' && process.env
    ? (process.env.API_KEY as string)
    : undefined;

const PLACEHOLDER_DOC =
  'As you talk, your teacher will update the lesson notes here...';

declare const MathJax: any;

/**
 * The placeholder component shown when the document is empty.
 * It introduces the key features of the application.
 */
const WelcomePlaceholder = () => (
  <div className="welcome-placeholder">
    <h1 className="welcome-placeholder-title">
      <span className="welcome-prefix">Welcome to </span>Intute
    </h1>
    <p className="welcome-placeholder-subtitle">
      Press the{' '}
      <span className="icon" style={{ verticalAlign: 'bottom' }}>
        play_arrow
      </span>{' '}
      button below to begin your lesson.
    </p>
    <div className="placeholder-features-grid">
      <div className="placeholder-feature">
        <span className="icon">record_voice_over</span>
        <div>
          <h3>Interactive Lessons</h3>
          <p className="feature-desc">Just talk, and your teacher explains concepts on the virtual lesson document.</p>
        </div>
      </div>
      <div className="placeholder-feature">
        <span className="icon">auto_awesome</span>
        <div>
          <h3>Visual Learning</h3>
          <p className="feature-desc">If you are a visual learner, ask Intute to make a diagram or visualization to teach you.</p>
        </div>
      </div>
      <div className="placeholder-feature">
        <span className="icon">people</span>
        <div>
          <h3>Choose Your Teacher</h3>
          <p className="feature-desc">Select from AI teachers to find a style in a language or mix of languages that work for you.</p>
        </div>
      </div>
      <div className="placeholder-feature">
        <span className="icon">edit_document</span>
        <div>
          <h3>You're in Control</h3>
          <p className="feature-desc">Be demanding. Tell Intute exactly how you would like to be taught and how you would like to be tested.</p>
        </div>
      </div>
    </div>
  </div>
);

/**
 * A memoized component to render HTML content and then apply MathJax typesetting.
 */
const MathJaxRenderer = memo(({ htmlContent }: { htmlContent: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        const currentElement = containerRef.current;
        // Clear previous typesetting to prevent errors like "label multiply defined" on re-renders.
        MathJax.typesetClear([currentElement]);
        // Typeset the new content.
        MathJax.typesetPromise([currentElement]).catch((err: Error) =>
          console.error('MathJax typesetting error:', err),
        );
      }
    }
  }, [htmlContent]);

  return (
    <div
      ref={containerRef}
      className="mathjax_ignore"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
});

// Fix: Wrap ImageInsertLoader with React.memo to make its props compatible with the `key` prop.
const ImageInsertLoader = memo(({ insert, onCancel }: { insert: ImageInsert; onCancel: (id: string, prompt: string) => void; }) => {
  const [showCancel, setShowCancel] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCancel(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []); // Run only once

  return (
    <div className="illustration-loading" title={`Generating: ${insert.prompt}`}>
      <div className="spinner"></div>
      <span>Generating diagram...</span>
      {showCancel && (
        <div className="long-generation-notice">
          <p>Image generation on gemini-3-pro-image-preview is taking longer than expected.</p>
          <button onClick={() => onCancel(insert.id, insert.prompt)}>
            Cancel Generation
          </button>
        </div>
      )}
    </div>
  );
});

// =================================================================
// DOCUMENT RENDERING COMPONENTS
// =================================================================
interface ResizableImageProps {
  id: string;
  src: string;
  alt: string;
  initialWidth: string | null; // e.g., "80%"
  onResize: (id: string, newWidth: string) => void;
}

const ResizableImage: React.FC<ResizableImageProps> = ({
  id,
  src,
  alt,
  initialWidth,
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only handle left-clicks
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      const parent = container?.parentElement;
      if (!container || !parent) return;

      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const parentWidth = parent.offsetWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        let newWidthPx = startWidth + dx;

        // Constrain width
        if (newWidthPx < 50) newWidthPx = 50; // min width
        if (newWidthPx > parentWidth) newWidthPx = parentWidth; // max width

        container.style.width = `${newWidthPx}px`;
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (container) {
          const finalWidthPx = container.offsetWidth;
          const finalWidthPercent = (finalWidthPx / parentWidth) * 100;
          // Set container style back to percentage so it's responsive.
          container.style.width = `${finalWidthPercent.toFixed(2)}%`;
          onResize(id, `${finalWidthPercent.toFixed(2)}%`);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [id, onResize],
  );

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      ref={containerRef}
      className={c('illustration-container resizable', { minimized: isMinimized })}
      style={{ width: isMinimized ? '150px' : (initialWidth || '100%') }}
      onClick={toggleMinimize}
      title={isMinimized ? "Click to maximize" : alt}
    >
      <img src={src} alt={alt} />
      {!isMinimized && (
        <div className="resize-handle" onMouseDown={handleMouseDown}></div>
      )}
    </div>
  );
};

const TextPartRenderer = memo(({ text }: { text: string }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (text.trim() === '') {
      setHtml('');
      return;
    }

    // 1. Identify Math Blocks
    // We must protect LaTeX math environments from the Markdown parser.
    // The patterns cover: $$...$$, \[...\], $...$, and \(...\).
    // The inline math pattern $...$ is specifically designed to ignore currency symbols.
    const allMathEnvPattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$([^\s$](?:[^\n$]*?[^~+\-*#\\\s$])?)\$|\\\([\s\S]*?\\\))/g;
    
    // Store the extracted math blocks.
    const mathBlocks: string[] = [];
    
    // Replace all math blocks with a unique placeholder that the Markdown parser will ignore.
    // We utilize a simple string "MATHBLOCK" followed by an index to avoid any Markdown characters (like underscores).
    const textWithPlaceholders = text.replace(allMathEnvPattern, (match) => {
      // Process \colorbox inside math to \bbox before storing
      const processedMatch = match.replace(
        /\\colorbox\{(.*?)\}\{(.*?)\}/gs,
        '\\bbox[$1]{$2}',
      );
      mathBlocks.push(processedMatch);
      return `MATHBLOCK${mathBlocks.length - 1}`;
    });
    
    // 2. Convert Markdown to HTML
    // We also replace double backslashes with <br/> to support LaTeX-style line breaks if used by the model.
    const markdownText = textWithPlaceholders.replace(/\\\\/g, '<br/>');
    let processedHtml = marked.parse(markdownText, { breaks: true, gfm: true }) as string;

    // 3. Restore Math Blocks
    // We swap the placeholders back for the original LaTeX math code, wrapped in a processing class.
    const finalHtml = processedHtml.replace(/MATHBLOCK(\d+)/g, (match, index) => {
        return `<span class="mathjax_process">${mathBlocks[parseInt(index, 10)]}</span>`;
    });
    
    setHtml(finalHtml);
  }, [text]);

  // Pass the combined HTML (Markdown structure + LaTeX math) to the MathJax renderer.
  return <MathJaxRenderer htmlContent={html} />;
});

const DocumentRenderer = memo(
  ({
    content,
    inserts,
    onElementResize,
    onDismissInsert,
    onCancelImage,
    onMissingIllustration,
  }: {
    content: string;
    inserts: Insert[];
    onElementResize: (id: string, newWidth: string) => void;
    onDismissInsert: (id: string) => void;
    onCancelImage: (id: string, prompt: string) => void;
    onMissingIllustration: (prompt: string, style: string, hallucinatedId?: string) => void;
  }) => {
    // This custom parser robustly splits the document content into text and tag parts.
    // It correctly handles nested brackets inside quoted attributes (e.g., xDomain="[-10, 10]"),
    // which would break a simpler regex-based approach.
    const contentParts = useMemo(() => {
      if (!content) return [];
    
      const parts = [];
      let lastIndex = 0;
      // This regex finds the start of a potential tag.
      const tagRegex = /\[(illustration|graph)\s/g;
      let match;
    
      while ((match = tagRegex.exec(content)) !== null) {
        // Add any text that came before this potential tag.
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
    
        // Now, find the corresponding closing ']' for this tag,
        // carefully ignoring any brackets inside double quotes.
        let inQuotes = false;
        let tagEnd = -1;
        for (let i = match.index + match[0].length - 1; i < content.length; i++) {
          const char = content[i];
          if (char === '"') {
            // Toggle the inQuotes flag when a double quote is found.
            inQuotes = !inQuotes;
          } else if (char === ']' && !inQuotes) {
            // If we find a closing bracket and we're not inside quotes, this is the end of our tag.
            tagEnd = i;
            break;
          }
        }
    
        if (tagEnd !== -1) {
          // A valid tag was found and parsed.
          const tag = content.substring(match.index, tagEnd + 1);
          parts.push(tag);
          lastIndex = tagEnd + 1;
        } else {
          // Malformed tag (no closing bracket found). Treat the start as plain text.
          // To prevent an infinite loop, we advance the index past the '[graph ' part.
          lastIndex = match.index + match[0].length;
        }
        // Ensure the regex continues searching from the new position.
        tagRegex.lastIndex = lastIndex;
      }
    
      // Add any remaining text after the last found tag.
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }
    
      return parts;
    }, [content]);

    // Helper to parse array-like strings from attributes.
    const parseArrayString = (str: string | null): string[] => {
      if (!str || str.length < 2) return [];
      try {
        // This parser is designed to be robust against malformed string literals
        // that a model might produce, like unescaped quotes inside a string (e.g., 'f''(x)').
        // It works by splitting the array content by commas that delimit the
        // single-quoted strings, rather than trying to parse it as strict JSON.

        // 1. Remove the outer brackets of the array string.
        const content = str.substring(1, str.length - 1);

        // 2. Split the string into parts. The regex splits by a comma, but only
        // if that comma is followed by an optional space and then a single quote.
        // This is a good heuristic for finding the boundaries between elements.
        const parts = content.split(/,(?=\s*')/);
        
        // 3. Clean up each part.
        return parts.map(part => {
          const trimmedPart = part.trim();
          // Remove the leading and trailing single quotes from each element.
          if (trimmedPart.startsWith("'") && trimmedPart.endsWith("'")) {
            return trimmedPart.substring(1, trimmedPart.length - 1);
          }
          // Return the trimmed part as-is if it's not quoted (shouldn't happen).
          return trimmedPart;
        });
      } catch (e) {
        console.error("Failed to parse array string from graph spec:", str, e);
        return [];
      }
    };

    // Helper to evaluate domain strings that might contain math (e.g. [-2*pi, 2*pi])
    const evaluateDomain = (str: string | null, fallback: [number, number]): [number, number] => {
      if (!str) return fallback;
      try {
        // Try standard JSON first
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
        return fallback;
      } catch (e) {
        // If JSON fails, it likely contains math constants like 'pi'
        try {
          const content = str.trim();
          if (!content.startsWith('[') || !content.endsWith(']')) return fallback;
          
          const inner = content.substring(1, content.length - 1);
          const parts = inner.split(',');
          const evaluated = parts.map(p => {
            let js = p.trim().toLowerCase()
              .replace(/pi/g, 'Math.PI')
              .replace(/e/g, 'Math.E');
            // Use Function constructor for a simple, scoped evaluation
            return new Function(`"use strict"; return (${js});`)();
          });

          if (evaluated.length === 2 && isFinite(evaluated[0]) && isFinite(evaluated[1])) {
            return evaluated as [number, number];
          }
        } catch (err) {
          console.error("Failed to evaluate math domain:", str, err);
        }
        return fallback;
      }
    };

    return (
      <>
        {contentParts.map((part, index) => {
          if (part.startsWith('[illustration')) {
            const idMatch = part.match(/id="([^"]+)"/);
            const widthMatch = part.match(/width="([^"]+)"/);
            const promptMatch = part.match(/prompt="([^"]+)"/) || part.match(/description="([^"]+)"/);
            const styleMatch = part.match(/style="([^"]+)"/);

            // Handle malformed tags that have a prompt but no ID (model hallucination)
            if (!idMatch && promptMatch) {
                const prompt = promptMatch[1];
                const style = styleMatch ? styleMatch[1] : 'textbook';
                // Trigger the fix in the parent component
                // We wrap it in a timeout to avoid updating state during render
                setTimeout(() => {
                    onMissingIllustration(prompt, style);
                }, 0);
                
                return (
                    <div key={index} className="illustration-loading">
                        <div className="spinner"></div>
                        <span>Initializing diagram...</span>
                    </div>
                );
            }

            if (!idMatch) return <span key={index}>{part}</span>;

            const id = idMatch[1];
            const width = widthMatch ? widthMatch[1] : null;
            const insert = inserts.find(ins => ins.id === id);

            if (!insert || insert.type !== 'image') {
              // If the model hallucinated an ID that doesn't exist in our store, 
              // but provided a prompt, we can try to "auto-fix" it by triggering a new generation.
              let prompt = promptMatch ? promptMatch[1] : null;
              
              // Fallback: If no prompt in tag, try to use the document title or context
              if (!prompt) {
                // Extract first H1 as title
                const titleMatch = content.match(/^#\s+(.+)$/m);
                if (titleMatch) {
                    prompt = `Diagram for: ${titleMatch[1]}`;
                } else {
                    prompt = "Educational diagram";
                }
              }

              const style = styleMatch ? styleMatch[1] : 'textbook';
              setTimeout(() => {
                  onMissingIllustration(prompt!, style, id);
              }, 0);
              
              return (
                  <div key={index} className="illustration-loading">
                      <div className="spinner"></div>
                      <span>Initializing diagram...</span>
                  </div>
              );
            }

            switch (insert.status) {
              case 'loading':
                return (
                  <ImageInsertLoader key={id} insert={insert} onCancel={onCancelImage} />
                );
              case 'error':
                return (
                  <div key={index} className="illustration-error" title={insert.error}>
                    <span className="icon">error</span>
                    <span>{insert.error || 'Error generating diagram.'}</span>
                    <button className="dismiss-button" onClick={() => onDismissInsert(id)}>
                      Dismiss
                    </button>
                  </div>
                );
              case 'done':
                return (
                  <ResizableImage
                    key={id}
                    id={id}
                    src={`data:image/png;base64,${insert.data}`}
                    alt={insert.prompt}
                    initialWidth={width}
                    onResize={onElementResize}
                  />
                );
              default:
                return <span key={index}>{part}</span>;
            }
          } else if (part.startsWith('[graph')) {
            try {
              // Parse the spec from the tag attributes
              const getAttr = (name: string) => {
                const match = part.match(new RegExp(`${name}="([^"]*)"`));
                return match ? match[1] : null;
              };

              const title = getAttr('title') || 'Graph';
              const functionsStr = getAttr('functions');
              const labelsStr = getAttr('labels');
              const xDomainStr = getAttr('xDomain');
              const yDomainStr = getAttr('yDomain');
              const width = getAttr('width');
              const xLabel = getAttr('xLabel');
              const yLabel = getAttr('yLabel');
              const colorsStr = getAttr('colors');
              
              const functions = parseArrayString(functionsStr);
              const labels = parseArrayString(labelsStr);
              const colors = parseArrayString(colorsStr);
              const xDomain = evaluateDomain(xDomainStr, [-10, 10]);
              const yDomain = evaluateDomain(yDomainStr, [-10, 10]);
              
              // Sanitize function strings to add explicit multiplication and handle e^x.
              const sanitizedFunctions = functions.map((fn: string) => {
                let sanitizedFn = fn.replace(/\s+/g, ''); // Remove whitespace

                // Convert e^... to exp(...) for robustness with the plotting library.
                // This is a two-pass replacement.
                // Pass 1: Handle parenthesized exponents, e.g., e^(2*x) -> exp(2*x)
                sanitizedFn = sanitizedFn.replace(/e\^\((.*?)\)/g, 'exp($1)');
                // Pass 2: Handle non-parenthesized exponents, e.g., e^x, e^-2x, e^-x^2
                // This regex captures a term that may start with a minus and contains alphanumeric chars and *, /, ^.
                // It will stop at a lower-precedence operator like + or another -.
                sanitizedFn = sanitizedFn.replace(/e\^(-?[a-zA-Z0-9*./^]+)/g, 'exp($1)');

                // Add implicit multiplication for cases like '2x' or '3sin(x)'
                sanitizedFn = sanitizedFn
                  .replace(/(\d)([a-zA-Z(])/g, '$1*$2') // 5x -> 5*x
                  .replace(/(\))([a-zA-Z(])/g, '$1*$2') // (x+1)(x-1) -> (x+1)*(x-1)
                  .replace(/(?<![a-zA-Z])([a-zA-Z])(\()/g, '$1*$2'); // x(x+1) -> x*(x+1)

                return sanitizedFn;
              });

              const graphData: GraphData = {
                title,
                functions: sanitizedFunctions,
                labels,
                xDomain,
                yDomain,
                xLabel: xLabel || undefined,
                yLabel: yLabel || undefined,
                colors: colors.length > 0 ? colors : undefined,
              };
              
              const id = `graph_${index}`; // Use index for a stable-ish key

              return (
                <FunctionPlotter
                  key={id}
                  id={id}
                  data={graphData}
                  initialWidth={width}
                  onResize={onElementResize}
                />
              );
            } catch (error: any) {
                console.error("Failed to parse or render graph spec:", part, error);
                return (
                  <div key={index} className="illustration-error" title={error.message}>
                    <span className="icon">error</span>
                    <span>Error parsing graph data.</span>
                  </div>
                );
            }
          }
          else if (part) {
            return <TextPartRenderer key={index} text={part} />;
          }
          return null;
        })}
      </>
    );
  },
);

/**
 * The primary component that orchestrates the collaborative writing experience.
 */
export default function KeynoteCompanion() {
  const { client, setConfig, stopAudio, connected, isConnecting } = useLiveAPIContext();
  const user = useUser();
  const { current } = useAgent();
  const {
    incrementChangeCount,
    setAgentState,
    suppressStaleAgentResponses,
    documentMode,
    imageTimeoutSeconds,
  } = useUI();
  const { inserts, addInsert, updateInsert, removeInsert } = useInsertStore();
  const {
    addTranscriptEntry,
    addAudioLogEntry,
    transcript,
    clearSession,
    documentContent,
    setDocumentContent,
  } = useSessionStore();
  const { addLog: addPerfLog } = usePerfLogStore();
  const [documentHistory, setDocumentHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileToolbar, setShowMobileToolbar] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'preparing' | 'generating'>('idle');

  const renderedViewRef = useRef<HTMLDivElement>(null);

  // =================================================================
  // STABLE REFS FOR EVENT HANDlers
  // =================================================================
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const documentContentRef = useRef(documentContent);
  documentContentRef.current = documentContent;
  const currentUserText = useRef('');
  const currentModelText = useRef('');
  const currentUserAudioChunks = useRef<ArrayBuffer[]>([]);
  const currentAgentAudioChunks = useRef<ArrayBuffer[]>([]);
  const docContentBeforeEditRef = useRef(documentContent);
  const promptVersionRef = useRef(0);
  const systemInstructionTextRef = useRef('');
  const lastTurnCompleteTimestampRef = useRef(0);
  const selfInterruptionDetectedRef = useRef(false);
  const lastSpeakerRef = useRef<'user' | 'agent' | null>(null);
  const hasSentGreetingRef = useRef(false);
  const turnCounterRef = useRef(0);
  const hasLoggedFirstUserTextThisTurnRef = useRef(false);
  const hasLoggedFirstAgentTextThisTurnRef = useRef(false);
  const hasLoggedFirstAgentAudioThisTurnRef = useRef(false);
  const latestUserTurnIdRef = useRef(0);
  const processedAgentTurnIdRef = useRef(0);
  const isSuppressingAgentOutputRef = useRef(false);
  const isAgentSpeakingRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const agentRef = useRef(current);
  agentRef.current = current;
  const ai = useRef(API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null);

  // This effect ensures all map containers have a unique ID, which is
  // necessary for tracking and persisting their resized dimensions.
  useEffect(() => {
    if (documentContent.includes('<div class="map-wrapper"')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = documentContent;
      let modified = false;
      // Find all map wrappers that do NOT have an ID attribute.
      tempDiv.querySelectorAll('.map-wrapper:not([id])').forEach(mapWrapper => {
        mapWrapper.id = `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        modified = true;
      });

      if (modified) {
        // This is an automatic update to prepare for resizing, so it should not
        // be part of the undo history.
        setDocumentContent(tempDiv.innerHTML);
      }
    }
  }, [documentContent]);

  const pushToHistory = (content: string) => {
    setDocumentHistory(prev => [...prev, content]);
    setRedoHistory([]);
  };

  // This callback updates the document content string with new dimensions for a resized map.
  const handleMapResize = useCallback(
    (id: string, newWidth: string, newHeight: string) => {
      const resizeMessage = `The user has changed the map dimensions of ${id} to width: ${newWidth}; height: ${newHeight}`;

      addTranscriptEntry({
        speaker: userRef.current.name || 'User',
        text: resizeMessage,
      });

      setDocumentContent(prevContent => {
        pushToHistory(prevContent);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = prevContent;
        const mapElement = tempDiv.querySelector(`#${id}`);

        if (mapElement && mapElement instanceof HTMLElement) {
          mapElement.style.width = newWidth;
          mapElement.style.height = newHeight;
          mapElement.style.paddingTop = '0'; // Override aspect ratio CSS
        }

        return tempDiv.innerHTML;
      });
    },
    [addTranscriptEntry],
  );

  // A ref to store information about the map being resized.
  const resizeTargetRef = useRef<{
    id: string;
    initialWidth: number;
    initialHeight: number;
  } | null>(null);

  // This handler is attached to the window on mouseup to capture the final
  // dimensions of a resized map.
  const handleRenderedContentMouseUp = useCallback(() => {
    if (resizeTargetRef.current && renderedViewRef.current) {
      const { id, initialWidth, initialHeight } = resizeTargetRef.current;
      const element = renderedViewRef.current.querySelector(`#${id}`);
      if (element) {
        // Re-enable pointer events on the iframe so the map is interactive again.
        const iframe = element.querySelector('iframe');
        if (iframe) {
          iframe.style.pointerEvents = 'auto';
        }

        const newWidth = (element as HTMLElement).offsetWidth;
        const newHeight = (element as HTMLElement).offsetHeight;
        if (newWidth !== initialWidth || newHeight !== initialHeight) {
          handleMapResize(id, `${newWidth}px`, `${newHeight}px`);
        }
      }
    }
    resizeTargetRef.current = null;
    window.removeEventListener('mouseup', handleRenderedContentMouseUp);
  }, [handleMapResize]);

  // This handler listens for a mousedown on a map container to begin
  // tracking a resize operation.
  const handleRenderedContentMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const mapWrapper = target.closest('.map-wrapper');

      if (
        mapWrapper &&
        mapWrapper.id &&
        getComputedStyle(mapWrapper).resize !== 'none'
      ) {
        // Disable pointer events on the iframe to prevent it from stealing focus
        // during the resize drag, which would stop the drag operation.
        const iframe = mapWrapper.querySelector('iframe');
        if (iframe) {
          iframe.style.pointerEvents = 'none';
        }

        resizeTargetRef.current = {
          id: mapWrapper.id,
          initialWidth: (mapWrapper as HTMLElement).offsetWidth,
          initialHeight: (mapWrapper as HTMLElement).offsetHeight,
        };
        window.addEventListener('mouseup', handleRenderedContentMouseUp, {
          once: true,
        });
      }
    },
    [handleRenderedContentMouseUp],
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!connected) {
      lastSpeakerRef.current = null;
      setAgentState(null);
      latestUserTurnIdRef.current = 0;
      processedAgentTurnIdRef.current = 0;
      isSuppressingAgentOutputRef.current = false;
    }
  }, [connected, setAgentState]);

  // This effect sends a greeting or resume prompt to the agent once the connection is established.
  useEffect(() => {
    if (connected && !isConnecting && !hasSentGreetingRef.current) {
      // Check if this is a new session or a resumed one.
      const isNewSession =
        transcript.length === 0 && documentContent === PLACEHOLDER_DOC;

      if (isNewSession) {
        // This is a fresh start, send the greeting prompt.
        client.send([
          {
            text: `(System message: The conversation has just begun. You are ${current.name}. Please proactively greet the user now in your assigned language/style and invite them to start the lesson. Do not wait for them to speak first.)`,
          },
        ]);
      } else {
        // This is a resumed session, instruct the agent to continue.
        // We include a snippet of the document to help orient the agent immediately.
        const docSnippet = documentContent.length > 500 ? documentContent.substring(0, 500) + "..." : documentContent;
        client.send([
          {
            text: `(System message: The session is resuming or the agent has been switched. You are now ${current.name}. IMPORTANT: You MUST call 'getContext' immediately to see the full lesson document and transcript before you speak. Continue the lesson from exactly where it left off. Do not change the topic unless the student asks. Current document starts with: "${docSnippet}")`,
          },
        ]);
      }
      hasSentGreetingRef.current = true;
    }
  }, [connected, isConnecting, client, transcript, documentContent, current]);

  // Reset the greeting flag when disconnected or when the agent changes
  useEffect(() => {
    if (!connected) {
      hasSentGreetingRef.current = false;
    }
  }, [connected]);

  useEffect(() => {
    // If we switch agents while connected, we want the new agent to speak up.
    if (connected) {
      hasSentGreetingRef.current = false;
      addTranscriptEntry({
        speaker: 'System',
        text: `Agent ${current.name} has taken over and will speak in ${current.languageLabel || 'English'} and continue the lesson.`,
      });
    }
  }, [current.id, connected, addTranscriptEntry, current.name, current.languageLabel]);

  // Declarations for the functions the agent can call.
  const getContextDeclaration: FunctionDeclaration = {
    name: 'getContext',
    description:
      "Gets the full context for the lesson, including the entire lesson document, the recent transcript, and student preferences. Call this before making any edits.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  };

  const updateDocumentDeclaration: FunctionDeclaration = {
    name: 'updateDocument',
    description:
      'Replaces the entire content of the lesson document with new content. Use Markdown for structure and LaTeX for math.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: 'The full, new content of the lesson document (Markdown format).',
        },
      },
      required: ['content'],
    },
  };

  const insertIllustrationDeclaration: FunctionDeclaration = {
    name: 'insertIllustration',
    description:
      "Generates a diagram or illustration based on a description and prepares it for insertion into the lesson document. Returns a unique placeholder tag that must be placed in the document via an 'updateDocument' call.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'A detailed description of the diagram to be generated. For example: "A simple diagram of the water cycle." or "A free-body diagram of a block on an inclined plane."',
        },
        style: {
          type: Type.STRING,
          enum: ['chalkboard', 'textbook', 'whiteboard'],
          description: 'Visual style. "textbook" for high-fidelity technical detail/schematics. "chalkboard" for conceptual sketches. "whiteboard" for diagrams with colored markers, like a classroom whiteboard.',
        },
      },
      required: ['prompt', 'style'],
    },
  };

  const inspectIllustrationDeclaration: FunctionDeclaration = {
    name: 'inspectIllustration',
    description:
      "Retrieves the actual image data for a specific illustration in the document and sends it to your visual input. Call this when you need to see or describe an existing image in detail.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: {
          type: Type.STRING,
          description: 'The unique ID of the illustration to inspect (e.g., "img_12345").',
        },
      },
      required: ['id'],
    },
  };

  useEffect(() => {
    promptVersionRef.current += 1;
    const systemInstructionText = createSystemInstructions(
      current,
      user,
      promptVersionRef.current,
    );
    systemInstructionTextRef.current = systemInstructionText;

    setConfig({
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: current.voice },
        },
      },
      systemInstruction: systemInstructionText,
      tools: [
        {
          functionDeclarations: [
            getContextDeclaration,
            updateDocumentDeclaration,
            insertIllustrationDeclaration,
            inspectIllustrationDeclaration,
          ],
        },
      ],
    });
  }, [setConfig, user, current]);

  useEffect(() => {
    if (!client) return;
    const handleOpen = () => {
      useLogStore.getState().addLog({
        api: 'System Prompt',
        inputSize: systemInstructionTextRef.current.length,
        outputSize: 'N/A',
        status: 'success',
        prompt: systemInstructionTextRef.current,
        promptVersion: systemInstructionTextRef.current.length,
      });
    };
    client.on('open', handleOpen);
    return () => {
      client.off('open', handleOpen);
    };
  }, [client]);

  const handleDocumentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDocumentContent(prevContent => {
      pushToHistory(prevContent);
      return e.target.value;
    });
  };

  const handleUndo = () => {
    if (documentHistory.length > 0) {
      const lastVersion = documentHistory[documentHistory.length - 1];
      setRedoHistory(prev => [documentContentRef.current, ...prev]);
      setDocumentHistory(prev => prev.slice(0, -1));
      setDocumentContent(lastVersion);
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      const nextVersion = redoHistory[0];
      pushToHistory(documentContentRef.current);
      setRedoHistory(prev => prev.slice(1));
      setDocumentContent(nextVersion);
    }
  };

  const handleElementResize = useCallback((id: string, newWidth: string) => {
    setDocumentContent(prevContent => {
      pushToHistory(prevContent);
      const regex = new RegExp(`\\[(illustration|graph) id="${id}"([^\\]]*)\\]`);
      const match = prevContent.match(regex);
      if (!match) return prevContent;

      const elementType = match[1];
      let attributes = match[2];
      if (attributes.includes('width=')) {
        attributes = attributes.replace(/width="[^"]+"/, `width="${newWidth}"`);
      } else {
        attributes += ` width="${newWidth}"`;
      }
      const newPlaceholder = `[${elementType} id="${id}"${attributes}]`;
      return prevContent.replace(match[0], newPlaceholder);
    });
  }, []);
  
  const handleDismissInsert = useCallback((id: string) => {
    setDocumentContent(prevContent => {
        pushToHistory(prevContent);
        // Regex to find the illustration tag with the specific id, any attributes it might have,
        // and any trailing whitespace (like a newline) to clean up the document.
        const regex = new RegExp(`\\[illustration id="${id}"[^\\]]*\\]\\s*`, 'g');
        return prevContent.replace(regex, '');
    });
    removeInsert(id);
  }, [removeInsert]);
  
  const handleCancelImageGeneration = useCallback((id: string, prompt: string) => {
    // 1. Remove the insert from the store, which will unmount the loader component.
    removeInsert(id);

    // 2. Remove the corresponding tag from the document content.
    setDocumentContent(prevContent => {
        pushToHistory(prevContent);
        const regex = new RegExp(`\\[illustration id="${id}"[^\\]]*\\]\\s*`, 'g');
        return prevContent.replace(regex, '');
    });

    // 3. Add a system message to the transcript to inform the model about the cancellation.
    addTranscriptEntry({
        speaker: 'System',
        text: `(User canceled the image generation for prompt: "${prompt}")`,
    });
  }, [removeInsert, addTranscriptEntry]);

  const handleMissingIllustration = useCallback((prompt: string, style: string, hallucinatedId?: string) => {
    // Check if we've already started generating this specific prompt to avoid infinite loops
    // We can check if there's an existing insert with this prompt
    const existingInsert = useInsertStore.getState().inserts.find(i => i.prompt === prompt);
    if (existingInsert) return;

    const id = `img_${Date.now()}`;
    addInsert({ id, prompt, status: 'loading', type: 'image' });

    // Replace the malformed tag in the document with the correct one
    setDocumentContent(prevContent => {
        const safePromptForAttr = prompt.replace(/"/g, "'").replace(/[\[\]]/g, '');
        const newTag = `[illustration id="${id}" description="${safePromptForAttr}"]`;

        if (hallucinatedId) {
            // If we have a specific ID that was hallucinated, replace that exact tag
            const regex = new RegExp(`\\[illustration\\s+id="${hallucinatedId}"[^\\]]*\\]`);
            return prevContent.replace(regex, newTag);
        } else {
            // Otherwise look for the tag by prompt
            const safePrompt = prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape for regex
            const regex = new RegExp(`\\[illustration\\s+prompt="${safePrompt}"[^\\]]*\\]`);
            return prevContent.replace(regex, newTag);
        }
    });

    // Trigger the actual image generation
    // We can reuse the logic from handleToolCall by extracting it, but for now, 
    // let's just emit a tool call event or call the generation logic directly.
    // Since we can't easily emit a fake tool call from here without refactoring,
    // we will duplicate the generation logic slightly or refactor.
    // Refactoring is safer. Let's create a helper function for image generation.
    generateImage(id, prompt, style);

  }, [addInsert, setDocumentContent]);

  // Helper function to generate image (extracted from handleToolCall)
  const generateImage = useCallback((id: string, prompt: string, style: string) => {
      if (!ai.current) return;
      
      const model = 'gemini-3-pro-image-preview';
      const TIMEOUT_SECONDS = imageTimeoutSeconds;

      // Determine the language for the diagram based on the current agent.
      const agentId = agentRef.current.id;
      let languageInstruction = ' The diagram and any text labels MUST be in English.';
      if (agentId === 'seema') {
        languageInstruction = ' The diagram and any text labels MUST be in Hindi.';
      } else if (agentId === 'juan') {
        languageInstruction = ' The diagram and any text labels MUST be in Spanish.';
      }

      let finalPrompt = prompt;
      if (style === 'chalkboard') {
        finalPrompt = `A multicolored teacher drawn chalk illustration on a blackboard of ${prompt}.${languageInstruction}`;
      } else if (style === 'textbook') {
        finalPrompt = `A professional, high-detail scientific textbook diagram of ${prompt}, white background, clear labels, high resolution.${languageInstruction}`;
      } else if (style === 'whiteboard') {
        finalPrompt = `A simple, clear diagram on a whiteboard using colored markers, illustrating ${prompt}.${languageInstruction}`;
      } else {
        finalPrompt = `A diagram of ${prompt}.${languageInstruction}`;
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`The model call to ${model} has timed out after ${TIMEOUT_SECONDS} seconds.`)),
          TIMEOUT_SECONDS * 1000
        )
      );

      Promise.race([
        ai.current.models.generateContent({
          model,
          contents: { parts: [{ text: finalPrompt }] },
        }),
        timeoutPromise,
      ])
        .then(response => {
          const res = response as GenerateContentResponse;
          const imagePart = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
          if (imagePart?.inlineData) {
            updateInsert(id, {
              status: 'done',
              data: imagePart.inlineData.data,
            });
          } else {
            const textResponse = res.text;
            const errorMessage = textResponse ? `API returned text instead of image: ${textResponse}` : 'No image data received from API.';
            throw new Error(errorMessage);
          }
        })
        .catch(error => {
          console.warn('Image generation failed:', error.message);
          updateInsert(id, { status: 'error', error: error.message });
        });
  }, [imageTimeoutSeconds, updateInsert]);

  // =================================================================
  // MAIN EVENT HANDLER
  // =================================================================
  // This useEffect sets up the listeners for the GenAILiveClient events.
  // It handles:
  // 1. Audio streaming (user input and agent output).
  // 2. Text transcription (input and output).
  // 3. Tool calls (the agent asking to perform actions).
  // 4. Turn completion (detecting when the user or agent has finished speaking).
  // 5. Interruption handling.
  useEffect(() => {
    const log = useLogStore.getState().addLog;
    const shouldSuppress =
      suppressStaleAgentResponses &&
      processedAgentTurnIdRef.current < latestUserTurnIdRef.current - 1;
    if (shouldSuppress && !isSuppressingAgentOutputRef.current) {
      stopAudio();
    }
    isSuppressingAgentOutputRef.current = shouldSuppress;

    const flushModelTextBuffer = () => {
      if (isSuppressingAgentOutputRef.current) {
        currentModelText.current = '';
        return;
      }
      const pendingText = currentModelText.current.trim();
      if (pendingText) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Action: Flushing Text Buffer',
          details: { text: pendingText },
        });
        
        // Optimistically update transcript for UI
        addTranscriptEntry({
            speaker: agentRef.current.name,
            text: pendingText,
        });

        log({
          api: 'Agent Response (Flush)',
          inputSize: 'N/A',
          outputSize: pendingText.length,
          status: 'success',
          response: pendingText,
          promptVersion: promptVersionRef.current,
        });
        currentModelText.current = '';
        lastSpeakerRef.current = 'agent';
      }
    };

    const handleToolCall = (toolCall: LiveServerToolCall) => {
      if (isSuppressingAgentOutputRef.current) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Action: Suppressed Stale Tool Call',
          details: {
            functionNames: toolCall.functionCalls.map(fc => fc.name),
            latestUserTurnId: latestUserTurnIdRef.current,
            processedAgentTurnId: processedAgentTurnIdRef.current,
          },
        });
        const functionResponses: FunctionResponse[] =
          toolCall.functionCalls.map(fc => ({
            id: fc.id,
            name: fc.name,
            response: { result: { status: 'OK - Suppressed by client' } },
          }));
        client.sendToolResponse({ functionResponses });
        return;
      }
      log({
        api: 'Function Call (Received)',
        inputSize: 'N/A',
        outputSize: 'N/A',
        status: 'success',
        prompt: JSON.stringify(toolCall.functionCalls),
        promptVersion: promptVersionRef.current,
      });
      addPerfLog({
        turn: turnCounterRef.current,
        event: 'Agent Action: Tool Call Received',
        details: { functionNames: toolCall.functionCalls.map(fc => fc.name) },
      });
      
      // Capture pending text to send in context, to avoid repetition.
      const pendingText = currentModelText.current.trim();
      flushModelTextBuffer();
      const functionResponses: FunctionResponse[] = [];

      for (const fc of toolCall.functionCalls) {
        let result: Record<string, any> = { status: 'OK' };

        switch (fc.name) {
          case 'getContext': {
            setAgentState('Processing Context');
            const currentDoc = documentContentRef.current;
            const documentContext =
              currentDoc === PLACEHOLDER_DOC
                ? '(The document is currently empty.)'
                : currentDoc;
            const recentTranscript = transcriptRef.current
              .slice(-10)
              .map(t => `${t.speaker}: ${t.text}`)
              .join('\n');
            const textToAppend = pendingText ? `\n${agentRef.current.name}: ${pendingText}` : '';
            
            result = {
              documentContent: documentContext,
              recentTranscript: `${recentTranscript}${textToAppend}`,
              studentInfo: `Name: "${userRef.current.name}", Topic: "${userRef.current.topic}", Background: "${userRef.current.info}"`,
            };
            break;
          }
          case 'updateDocument': {
            setAgentState('Updating Lesson');
            const { content } = fc.args;
            if (typeof content === 'string') {
              pushToHistory(documentContentRef.current);
              setDocumentContent(content);
              incrementChangeCount();
              docContentBeforeEditRef.current = content;
            }
            break;
          }
          case 'insertIllustration': {
            setAgentState('Creating Diagram');
            const { prompt, style } = fc.args;
            if (typeof prompt === 'string' && ai.current) {
              const id = `img_${Date.now()}`;
              addInsert({ id, prompt, status: 'loading', type: 'image' });

              const safePrompt = prompt
                .replace(/"/g, "'")
                .replace(/[\[\]]/g, '');
              const placeholder = `[illustration id="${id}" description="${safePrompt}"]`;
              result = { placeholder };

              generateImage(id, prompt, style as string);
            }
            break;
          }
          case 'inspectIllustration': {
            setAgentState('Getting Image');
            const { id } = fc.args;
            if (typeof id === 'string') {
              const insert = useInsertStore.getState().inserts.find(i => i.id === id);
              if (insert && insert.data) {
                // Send the image as a realtime input so the model can see it
                client.sendRealtimeInput({
                  media: {
                    mimeType: 'image/png',
                    data: insert.data,
                  },
                });
                result = { status: 'SUCCESS', message: `Image ${id} has been sent to your visual input buffer.` };
              } else {
                result = { status: 'ERROR', message: `Image with ID ${id} not found or not yet generated.` };
              }
            }
            break;
          }
        }
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result },
        });
      }

      if (functionResponses.length > 0) {
        client.sendToolResponse({ functionResponses });
        log({
          api: 'Function Call (Response)',
          inputSize: 'N/A',
          outputSize: JSON.stringify(functionResponses).length,
          status: 'success',
          response: JSON.stringify(functionResponses),
          promptVersion: promptVersionRef.current,
        });
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Action: Tool Response Sent',
          details: { functionResponses },
        });
      }
    };

    const handleUserAudio = (data: ArrayBuffer) => {
      currentUserAudioChunks.current.push(data);
    };

    const handleAgentAudio = (data: ArrayBuffer) => {
      if (isSuppressingAgentOutputRef.current) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Response: Suppressed Stale Audio',
          details: {
            size: data.byteLength,
            latestUserTurnId: latestUserTurnIdRef.current,
            processedAgentTurnId: processedAgentTurnIdRef.current,
          },
        });
        return;
      }
      currentAgentAudioChunks.current.push(data);
      if (!hasLoggedFirstAgentAudioThisTurnRef.current) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Response: First Audio Chunk Received',
          details: { size: data.byteLength },
        });
        log({
          api: 'Agent Response (Audio)',
          inputSize: 'N/A',
          outputSize: 'N/A',
          audioSize: data.byteLength,
          status: 'success',
          promptVersion: promptVersionRef.current,
        });
        hasLoggedFirstAgentAudioThisTurnRef.current = true;
      }
    };

    const handleInputTranscription = (text: string) => {
      if (!hasLoggedFirstUserTextThisTurnRef.current && text.trim()) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'User Speech: First Text Chunk Received',
          details: { text },
        });
        hasLoggedFirstUserTextThisTurnRef.current = true;
      }
      if (isAgentSpeakingRef.current) {
        selfInterruptionDetectedRef.current = true;
      }
      currentUserText.current += text;
    };

    const handleOutputTranscription = (text: string) => {
      if (isSuppressingAgentOutputRef.current) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Response: Suppressed Stale Text',
          details: {
            text,
            latestUserTurnId: latestUserTurnIdRef.current,
            processedAgentTurnId: processedAgentTurnIdRef.current,
          },
        });
        return;
      }
      if (!hasLoggedFirstAgentTextThisTurnRef.current && text.trim()) {
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Response: First Text Chunk Received',
          details: { text },
        });
        log({
          api: 'Agent Response (Text)',
          inputSize: 'N/A',
          outputSize: text.length,
          status: 'success',
          promptVersion: promptVersionRef.current,
        });
        hasLoggedFirstAgentTextThisTurnRef.current = true;
      }

      if (!isAgentSpeakingRef.current) {
        isAgentSpeakingRef.current = true;
        setAgentState(null);
      }
      currentModelText.current += text;
    };

    const handleTurnComplete = () => {
      const now = Date.now();
      if (now - lastTurnCompleteTimestampRef.current < 500) {
        return;
      }
      lastTurnCompleteTimestampRef.current = now;
      const userFinal = currentUserText.current.trim();
      const agentFinal = currentModelText.current.trim();
      
      // Sync transcript with global store
      if (userFinal) {
        addTranscriptEntry({
            speaker: userRef.current.name,
            text: userFinal,
        });
      }
      
      if (agentFinal && !isSuppressingAgentOutputRef.current) {
        addTranscriptEntry({
            speaker: agentRef.current.name,
            text: agentFinal,
        });
      }

      if (userFinal) {
        latestUserTurnIdRef.current++;
        turnCounterRef.current += 1;
        hasLoggedFirstAgentAudioThisTurnRef.current = false;
        hasLoggedFirstAgentTextThisTurnRef.current = false;
        hasLoggedFirstUserTextThisTurnRef.current = false;
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'User Turn: End Detected',
          details: { text: userFinal, turnId: latestUserTurnIdRef.current },
        });
        setAgentState('Thinking');
        const combinedUserAudio = new Blob(currentUserAudioChunks.current);
        if (combinedUserAudio.size > 0) {
          addAudioLogEntry({
              speaker: user.name,
              blob: combinedUserAudio,
              timestamp: new Date(),
          });
        }
        log({
          api: 'User Speech (Final)',
          inputSize: userFinal.length,
          outputSize: 'N/A',
          audioSize: combinedUserAudio.size,
          status: 'success',
          prompt: userFinal,
          promptVersion: promptVersionRef.current,
        });
        lastSpeakerRef.current = 'user';
      }

      if (agentFinal) {
        processedAgentTurnIdRef.current++;
        addPerfLog({
          turn: turnCounterRef.current,
          event: 'Agent Turn: End Detected',
          details: {
            text: agentFinal,
            processedTurnId: processedAgentTurnIdRef.current,
            wasSuppressed: isSuppressingAgentOutputRef.current,
          },
        });
        const combinedAgentAudio = new Blob(currentAgentAudioChunks.current);
        if (
          combinedAgentAudio.size > 0 &&
          !isSuppressingAgentOutputRef.current
        ) {
          addAudioLogEntry({
              speaker: current.name,
              blob: combinedAgentAudio,
              timestamp: new Date(),
          });
        }
        lastSpeakerRef.current = 'agent';
      }

      currentUserText.current = '';
      currentModelText.current = '';
      currentUserAudioChunks.current = [];
      currentAgentAudioChunks.current = [];
      selfInterruptionDetectedRef.current = false;
      isAgentSpeakingRef.current = false;
    };

    client.on('userAudio', handleUserAudio);
    client.on('audio', handleAgentAudio);
    client.on('toolcall', handleToolCall);
    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('turncomplete', handleTurnComplete);
    client.on('interrupted', stopAudio);

    return () => {
      client.off('userAudio', handleUserAudio);
      client.off('audio', handleAgentAudio);
      client.off('toolcall', handleToolCall);
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('turncomplete', handleTurnComplete);
      client.off('interrupted', stopAudio);
    };
  }, [
    client,
    stopAudio,
    user.name,
    current.name,
    incrementChangeCount,
    setAgentState,
    addPerfLog,
    suppressStaleAgentResponses,
    addTranscriptEntry,
    addAudioLogEntry,
    imageTimeoutSeconds,
  ]);

  const handleClear = () => {
    setDocumentContent(PLACEHOLDER_DOC);
    setDocumentHistory([]);
    setRedoHistory([]);
    clearSession();
  };

  const handleCopyPlainText = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    });
  };
  
  const handleCopy = async () => {
    if (!renderedViewRef.current || documentContent === PLACEHOLDER_DOC) {
        handleCopyPlainText(documentContent);
        return;
    }

    const elementToCapture = renderedViewRef.current;
    
    try {
      setCopyButtonText('Copying...');
      
      // Temporarily expand to full size to capture everything
      const originalHeight = elementToCapture.style.height;
      const originalOverflow = elementToCapture.style.overflow;
      const originalMaxHeight = elementToCapture.style.maxHeight;
      
      elementToCapture.style.height = 'auto';
      elementToCapture.style.overflow = 'visible';
      elementToCapture.style.maxHeight = 'none';
      
      // Force Light Theme for copy as well, for consistency
      const lightTheme = themes.find(t => t.name === 'Light Theme') || themes[1];
      elementToCapture.style.setProperty('--theme-bg', lightTheme.colors[0]);
      elementToCapture.style.setProperty('--theme-surface', lightTheme.colors[1]);
      elementToCapture.style.setProperty('--theme-accent', lightTheme.colors[2]);
      elementToCapture.style.setProperty('--theme-text', lightTheme.colors[3]);
      elementToCapture.style.setProperty('--theme-document-bg', lightTheme.colors[4]);
      elementToCapture.style.backgroundColor = lightTheme.colors[4];
      elementToCapture.style.color = lightTheme.colors[3];

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 100));

      const blob = await htmlToImage.toBlob(elementToCapture, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: lightTheme.colors[4],
        width: elementToCapture.scrollWidth,
        height: elementToCapture.scrollHeight,
        filter: (node) => {
            return !node.classList?.contains('exclude-from-pdf');
        }
      });

      // Restore styles
      elementToCapture.style.height = originalHeight;
      elementToCapture.style.overflow = originalOverflow;
      elementToCapture.style.maxHeight = originalMaxHeight;
      
      elementToCapture.style.removeProperty('--theme-bg');
      elementToCapture.style.removeProperty('--theme-surface');
      elementToCapture.style.removeProperty('--theme-accent');
      elementToCapture.style.removeProperty('--theme-text');
      elementToCapture.style.removeProperty('--theme-document-bg');
      elementToCapture.style.removeProperty('background-color');
      elementToCapture.style.removeProperty('color');

      if (!blob) throw new Error('Failed to generate image blob');

      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);
      
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      // Fallback to plain text if image copy fails
      handleCopyPlainText(documentContent);
    }
  };
  
  const handleDownloadPDF = async () => {
    if (pdfStatus !== 'idle' || documentContent === PLACEHOLDER_DOC) return;
  
    setPdfStatus('preparing');
    
    // Use the actual rendered view ref if available, otherwise we can't capture it properly
    // because the off-screen method might not be rendering styles/images correctly in time.
    // However, capturing the live view might include UI elements we don't want (like the cursor).
    // A better approach for the off-screen render is to ensure it's fully mounted and images loaded.
    
    // Let's try capturing the live rendered view directly first to see if it fixes the "blank" issue.
    // This is often more reliable than creating a fresh off-screen React root which might not have
    // fully processed styles or images by the time we snapshot it.
    const elementToCapture = renderedViewRef.current;
    
    if (!elementToCapture) {
        console.error("No content to capture");
        setPdfStatus('idle');
        return;
    }

    const topic = user.topic || 'intute_lesson';
    const filename = `${topic.replace(/\s/g, '_')}.pdf`;

    try {
      setPdfStatus('generating');
      
      // Capture the live element directly.
      // To avoid clipping, we temporarily modify the element's styles to show full content.
      const originalHeight = elementToCapture.style.height;
      const originalOverflow = elementToCapture.style.overflow;
      const originalMaxHeight = elementToCapture.style.maxHeight;
      
      // Expand to full size
      elementToCapture.style.height = 'auto';
      elementToCapture.style.overflow = 'visible';
      elementToCapture.style.maxHeight = 'none';
      
      // Force Light Theme variables on the container to ensure the capture uses light colors.
      // We apply these directly to the element's style to override the :root variables.
      const lightTheme = themes.find(t => t.name === 'Light Theme') || themes[1];
      elementToCapture.style.setProperty('--theme-bg', lightTheme.colors[0]);
      elementToCapture.style.setProperty('--theme-surface', lightTheme.colors[1]);
      elementToCapture.style.setProperty('--theme-accent', lightTheme.colors[2]);
      elementToCapture.style.setProperty('--theme-text', lightTheme.colors[3]);
      elementToCapture.style.setProperty('--theme-document-bg', lightTheme.colors[4]);
      
      // Explicitly set background and color
      elementToCapture.style.backgroundColor = lightTheme.colors[4];
      elementToCapture.style.color = lightTheme.colors[3];
      
      // Wait a tick for layout and styles to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await htmlToImage.toCanvas(elementToCapture, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: lightTheme.colors[4],
        width: elementToCapture.scrollWidth,
        height: elementToCapture.scrollHeight,
        filter: (node) => {
            return !node.classList?.contains('exclude-from-pdf');
        }
      });
      
      // Restore original styles
      elementToCapture.style.height = originalHeight;
      elementToCapture.style.overflow = originalOverflow;
      elementToCapture.style.maxHeight = originalMaxHeight;
      
      // Remove forced theme overrides
      elementToCapture.style.removeProperty('--theme-bg');
      elementToCapture.style.removeProperty('--theme-surface');
      elementToCapture.style.removeProperty('--theme-accent');
      elementToCapture.style.removeProperty('--theme-text');
      elementToCapture.style.removeProperty('--theme-document-bg');
      elementToCapture.style.removeProperty('background-color');
      elementToCapture.style.removeProperty('color');

      const imgData = canvas.toDataURL('image/jpeg');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfStatus('idle');
    }
  };

  const getPdfButtonText = () => {
    switch (pdfStatus) {
      case 'preparing': return 'Preparing...';
      case 'generating': return 'Generating...';
      default: return 'Download .pdf';
    }
  };

  return (
    <div className="keynote-companion">
      <div className="document-view-container">
        
        <div className="main-view-content">
            <div className="document-editor-container">
              {documentMode === 'editor' && (
                <>
                  <div className="document-toolbar">
                    {isMobile ? (
                      <div className="mobile-toolbar-container">
                        <span style={{ fontWeight: 500, opacity: 0.7 }}>
                          Actions
                        </span>
                        <button
                          className="mobile-menu-trigger"
                          onClick={() =>
                            setShowMobileToolbar(!showMobileToolbar)
                          }
                          title="Document Actions"
                        >
                          <span className="material-symbols-outlined">
                            more_vert
                          </span>
                        </button>
                        {showMobileToolbar && (
                          <>
                            <div
                              className="mobile-menu-overlay"
                              onClick={() => setShowMobileToolbar(false)}
                            />
                            <div className="mobile-menu-dropdown">
                              <button
                                onClick={() => {
                                  handleUndo();
                                  setShowMobileToolbar(false);
                                }}
                                disabled={documentHistory.length === 0}
                              >
                                <span className="material-symbols-outlined">
                                  undo
                                </span>{' '}
                                Undo
                              </button>
                              <button
                                onClick={() => {
                                  handleRedo();
                                  setShowMobileToolbar(false);
                                }}
                                disabled={redoHistory.length === 0}
                              >
                                <span className="material-symbols-outlined">
                                  redo
                                </span>{' '}
                                Redo
                              </button>
                              <button
                                onClick={() => {
                                  handleClear();
                                  setShowMobileToolbar(false);
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  delete
                                </span>{' '}
                                Clear
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleUndo}
                          disabled={documentHistory.length === 0}
                        >
                          Undo
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={redoHistory.length === 0}
                        >
                          Redo
                        </button>
                        <button onClick={handleClear}>Clear</button>
                      </>
                    )}
                  </div>
                  <textarea
                    className="document-textarea"
                    value={documentContent}
                    onChange={handleDocumentChange}
                    placeholder="The teacher's notes will appear here..."
                  />
                </>
              )}

              {/* Rendered View with Floating Actions */}
              {documentMode === 'rendered' && documentContent !== PLACEHOLDER_DOC && (
                <div className="floating-actions" style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                   <button
                    className="copy-button"
                    style={{ position: 'static' }}
                    onClick={handleDownloadPDF}
                    disabled={pdfStatus !== 'idle'}
                    title="Download PDF"
                  >
                    <span className="icon">picture_as_pdf</span>{' '}
                    {isMobile ? '' : (pdfStatus === 'idle' ? 'PDF' : getPdfButtonText())}
                  </button>
                  <button
                    className="copy-button"
                    style={{ position: 'static' }}
                    onClick={handleCopy}
                    title="Copy to Clipboard"
                  >
                    <span className="icon">content_copy</span>{' '}
                    {isMobile ? '' : copyButtonText}
                  </button>
                </div>
              )}

              {documentMode === 'rendered' && (
                <div
                  ref={renderedViewRef}
                  className={c('document-content prose-view', {
                    'placeholder-active': documentContent === PLACEHOLDER_DOC,
                  })}
                  onMouseDown={handleRenderedContentMouseDown}
                >
                  {documentContent === PLACEHOLDER_DOC ? (
                    <WelcomePlaceholder />
                  ) : (
                    <DocumentRenderer
                      content={documentContent}
                      inserts={inserts}
                      onElementResize={handleElementResize}
                      onDismissInsert={handleDismissInsert}
                      onCancelImage={handleCancelImageGeneration}
                      onMissingIllustration={handleMissingIllustration}
                    />
                  )}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}