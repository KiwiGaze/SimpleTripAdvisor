// app/page.tsx
/* eslint-disable @next/next/no-img-element */
"use client";
import 'katex/dist/katex.min.css';

import { BorderTrail } from '@/components/core/border-trail';
import { TextShimmer } from '@/components/core/text-shimmer';
import { FlightTracker } from '@/components/flight-tracker';
import { InstallPrompt } from '@/components/InstallPrompt';
import { MapComponent, MapContainer } from '@/components/map-components';
import MultiSearch from '@/components/multi-search';
import NearbySearchMapView from '@/components/nearby-search-map-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import WeatherChart from '@/components/weather-chart';
import { cn, getUserId, SearchGroupId } from '@/lib/utils';
import { CheckCircle, Info, RoadHorizon, Clock as PhosphorClock, CalendarBlank } from '@phosphor-icons/react';
import { TextIcon } from '@radix-ui/react-icons';
import { ToolInvocation } from 'ai';
import { useChat, UseChatOptions } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { GeistMono } from 'geist/font/mono';
import {
    AlignLeft,
    ArrowRight,
    Building,
    Calculator,
    Calendar,
    Check,
    ChevronDown,
    Cloud,
    Code,
    Copy,
    ExternalLink,
    FileText,
    Globe,
    LucideIcon,
    MapPin,
    Moon,
    Plane,
    Plus,
    Sun,
    TrendingUp,
    User2,
    X,
    RefreshCw,
    WrapText,
    ArrowLeftRight,
    Mountain
} from 'lucide-react';
import Marked, { ReactRenderer } from 'marked-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { parseAsString, useQueryState } from 'nuqs';
import React, {
    memo,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import Latex from 'react-latex-next';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tweet } from 'react-tweet';
import { toast } from 'sonner';
import {
    suggestQuestions
} from './actions';
import { CurrencyConverter } from '@/components/currency_conv';
import { ReasoningUIPart, ToolInvocationUIPart, TextUIPart, SourceUIPart } from '@ai-sdk/ui-utils';
import FormComponent from '@/components/ui/form-component';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from '@/components/ui/separator';
import ReasonSearch from '@/components/reason-search';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon } from '@radix-ui/react-icons';
import { ChevronLeft, ChevronRight } from "lucide-react";

export const maxDuration = 120;

interface Attachment {
    name: string;
    contentType: string;
    url: string;
    size: number;
}

const SearchLoadingState = ({
    icon: Icon,
    text,
    color
}: {
    icon: LucideIcon,
    text: string,
    color: "red" | "green" | "orange" | "violet" | "gray" | "blue"
}) => {
    const colorVariants = {
        red: {
            background: "bg-red-50 dark:bg-red-950",
            border: "from-red-200 via-red-500 to-red-200 dark:from-red-400 dark:via-red-500 dark:to-red-700",
            text: "text-red-500",
            icon: "text-red-500"
        },
        green: {
            background: "bg-green-50 dark:bg-green-950",
            border: "from-green-200 via-green-500 to-green-200 dark:from-green-400 dark:via-green-500 dark:to-green-700",
            text: "text-green-500",
            icon: "text-green-500"
        },
        orange: {
            background: "bg-orange-50 dark:bg-orange-950",
            border: "from-orange-200 via-orange-500 to-orange-200 dark:from-orange-400 dark:via-orange-500 dark:to-orange-700",
            text: "text-orange-500",
            icon: "text-orange-500"
        },
        violet: {
            background: "bg-violet-50 dark:bg-violet-950",
            border: "from-violet-200 via-violet-500 to-violet-200 dark:from-violet-400 dark:via-violet-500 dark:to-violet-700",
            text: "text-violet-500",
            icon: "text-violet-500"
        },
        gray: {
            background: "bg-neutral-50 dark:bg-neutral-950",
            border: "from-neutral-200 via-neutral-500 to-neutral-200 dark:from-neutral-400 dark:via-neutral-500 dark:to-neutral-700",
            text: "text-neutral-500",
            icon: "text-neutral-500"
        },
        blue: {
            background: "bg-blue-50 dark:bg-blue-950",
            border: "from-blue-200 via-blue-500 to-blue-200 dark:from-blue-400 dark:via-blue-500 dark:to-blue-700",
            text: "text-blue-500",
            icon: "text-blue-500"
        }
    };

    const variant = colorVariants[color];

    return (
        <Card className="relative w-full h-[100px] my-4 overflow-hidden shadow-none">
            <BorderTrail
                className={cn(
                    'bg-gradient-to-l',
                    variant.border
                )}
                size={80}
            />
            <CardContent className="p-6">
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "relative h-10 w-10 rounded-full flex items-center justify-center",
                            variant.background
                        )}>
                            <BorderTrail
                                className={cn(
                                    "bg-gradient-to-l",
                                    variant.border
                                )}
                                size={40}
                            />
                            <Icon className={cn("h-5 w-5", variant.icon)} />
                        </div>
                        <div className="space-y-2">
                            <TextShimmer
                                className="text-base font-medium"
                                duration={2}
                            >
                                {text}
                            </TextShimmer>
                            <div className="flex gap-2">
                                {[...Array(3)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                                        style={{
                                            width: `${Math.random() * 40 + 20}px`,
                                            animationDelay: `${i * 0.2}s`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const VercelIcon = ({ size = 16 }: { size: number }) => {
    return (
        <svg
            height={size}
            strokeLinejoin="round"
            viewBox="0 0 16 16"
            width={size}
            style={{ color: "currentcolor" }}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 1L16 15H0L8 1Z"
                fill="currentColor"
            ></path>
        </svg>
    );
};

const IconMapping: Record<string, LucideIcon> = {
    stock: TrendingUp,
    default: Code,
    date: Calendar,
    calculation: Calculator,
    output: FileText
};

interface CollapsibleSectionProps {
    code: string;
    output?: string;
    language?: string;
    title?: string;
    icon?: string;
    status?: 'running' | 'completed';
}

const HomeContent = () => {
    const [query] = useQueryState('query', parseAsString.withDefault(''))
    const [q] = useQueryState('q', parseAsString.withDefault(''))
    const [model] = useQueryState('model', parseAsString.withDefault('scira-default'))

    const initialState = useMemo(() => ({
        query: query || q,
        model: model
    }), [query, q, model]);

    const lastSubmittedQueryRef = useRef(initialState.query);
    const [selectedModel, setSelectedModel] = useState(initialState.model);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState(-1);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const initializedRef = useRef(false);
    const [selectedGroup, setSelectedGroup] = useState<SearchGroupId>('web');
    const [hasSubmitted, setHasSubmitted] = React.useState(false);
    const [hasManuallyScrolled, setHasManuallyScrolled] = useState(false);
    const isAutoScrollingRef = useRef(false);

    // Get stored user ID
    const userId = useMemo(() => getUserId(), []);

    const chatOptions: UseChatOptions = useMemo(() => ({
        api: '/api/search',
        experimental_throttle: 500,
        body: {
            model: selectedModel,
            group: selectedGroup,
            user_id: userId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        onFinish: async (message, { finishReason }) => {
            console.log("[finish reason]:", finishReason);
            if (message.content && (finishReason === 'stop' || finishReason === 'length')) {
                const newHistory = [
                    { role: "user", content: lastSubmittedQueryRef.current },
                    { role: "assistant", content: message.content },
                ];
                const { questions } = await suggestQuestions(newHistory);
                setSuggestedQuestions(questions);
            }
        },
        onError: (error) => {
            console.error("Chat error:", error.cause, error.message);
            toast.error("An error occurred.", {
                description: `Oops! An error occurred while processing your request. ${error.message}`,
            });
        },
    }), [selectedModel, selectedGroup, userId]);

    const {
        input,
        messages,
        setInput,
        append,
        handleSubmit,
        setMessages,
        reload,
        stop,
        status,
    } = useChat(chatOptions);

    useEffect(() => {
        if (!initializedRef.current && initialState.query && !messages.length) {
            initializedRef.current = true;
            console.log("[initial query]:", initialState.query);
            append({
                content: initialState.query,
                role: 'user'
            });
        }
    }, [initialState.query, append, setInput, messages.length]);

    const ThemeToggle: React.FC = () => {
        const { resolvedTheme, setTheme } = useTheme();

        return (
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        );
    };


    const CopyButton = ({ text }: { text: string }) => {
        const [isCopied, setIsCopied] = useState(false);

        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                    if (!navigator.clipboard) {
                        return;
                    }
                    await navigator.clipboard.writeText(text);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                    toast.success("Copied to clipboard");
                }}
                className="h-8 px-2 text-xs rounded-full"
            >
                {isCopied ? (
                    <Check className="h-4 w-4" />
                ) : (
                    <Copy className="h-4 w-4" />
                )}
            </Button>
        );
    };

    interface MarkdownRendererProps {
        content: string;
    }

    interface CitationLink {
        text: string;
        link: string;
    }
    const isValidUrl = (str: string) => {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    };

    const preprocessLaTeX = (content: string) => {
        // First, handle escaped delimiters to prevent double processing
        let processedContent = content
            .replace(/\\\[/g, '___BLOCK_OPEN___')
            .replace(/\\\]/g, '___BLOCK_CLOSE___')
            .replace(/\\\(/g, '___INLINE_OPEN___')
            .replace(/\\\)/g, '___INLINE_CLOSE___');

        // Process block equations
        processedContent = processedContent.replace(
            /___BLOCK_OPEN___([\s\S]*?)___BLOCK_CLOSE___/g,
            (_, equation) => `$$${equation.trim()}$$`
        );

        // Process inline equations
        processedContent = processedContent.replace(
            /___INLINE_OPEN___([\s\S]*?)___INLINE_CLOSE___/g,
            (_, equation) => `$${equation.trim()}$`
        );

        // Handle common LaTeX expressions not wrapped in delimiters
        processedContent = processedContent.replace(
            /(\b[A-Z](?:_\{[^{}]+\}|\^[^{}]+|_[a-zA-Z\d]|\^[a-zA-Z\d])+)/g, 
            (match) => `$${match}$`
        );

        // Handle any remaining escaped delimiters that weren't part of a complete pair
        processedContent = processedContent
            .replace(/___BLOCK_OPEN___/g, '\\[')
            .replace(/___BLOCK_CLOSE___/g, '\\]')
            .replace(/___INLINE_OPEN___/g, '\\(')
            .replace(/___INLINE_CLOSE___/g, '\\)');

        return processedContent;
    };

    const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
        const citationLinks = useMemo<CitationLink[]>(() => {
            // Improved regex to better handle various markdown link formats
            return Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).map(match => {
                const text = match[1]?.trim() || '';
                const link = match[2]?.trim() || '';
                return { text, link };
            });
        }, [content]);

        interface CodeBlockProps {
            language: string | undefined;
            children: string;
        }

        const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
            const [isCopied, setIsCopied] = useState(false);
            const [isWrapped, setIsWrapped] = useState(false);
            const { theme } = useTheme();

            const handleCopy = useCallback(async () => {
                await navigator.clipboard.writeText(children);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }, [children]);

            const toggleWrap = useCallback(() => {
                setIsWrapped(prev => !prev);
            }, []);

            return (
                <div className="group my-5 relative">
                    <div className="rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                            <div className="px-2 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                {language || 'text'}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={toggleWrap}
                                    className={`
                                      px-2 py-1
                                      rounded text-xs font-medium
                                      transition-all duration-200
                                      ${isWrapped ? 'text-primary' : 'text-neutral-500 dark:text-neutral-400'}
                                      hover:bg-neutral-200 dark:hover:bg-neutral-700
                                      flex items-center gap-1.5
                                    `}
                                    aria-label="Toggle line wrapping"
                                >
                                    {isWrapped ? (
                                        <>
                                            <ArrowLeftRight className="h-3 w-3" />
                                            <span className="hidden sm:inline">Unwrap</span>
                                        </>
                                    ) : (
                                        <>
                                            <WrapText className="h-3 w-3" />
                                            <span className="hidden sm:inline">Wrap</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className={`
                                      px-2 py-1
                                      rounded text-xs font-medium
                                      transition-all duration-200
                                      ${isCopied ? 'text-primary dark:text-primary' : 'text-neutral-500 dark:text-neutral-400'}
                                      hover:bg-neutral-200 dark:hover:bg-neutral-700
                                      flex items-center gap-1.5
                                    `}
                                    aria-label="Copy code"
                                >
                                    {isCopied ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            <span className="hidden sm:inline">Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            <span className="hidden sm:inline">Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <SyntaxHighlighter
                            language={language || 'text'}
                            style={theme === 'dark' ? oneDark : oneLight}
                            customStyle={{
                                margin: 0,
                                padding: '0.75rem 0.25rem 0.75rem',
                                backgroundColor: theme === 'dark' ? '#171717' : 'transparent',
                                borderRadius: 0,
                                borderBottomLeftRadius: '0.375rem',
                                borderBottomRightRadius: '0.375rem',
                                fontFamily: GeistMono.style.fontFamily,
                            }}
                            showLineNumbers={true}
                            lineNumberStyle={{
                                textAlign: 'right',
                                color: theme === 'dark' ? '#6b7280' : '#808080',
                                backgroundColor: 'transparent',
                                fontStyle: 'normal',
                                marginRight: '1em',
                                paddingRight: '0.5em',
                                fontFamily: GeistMono.style.fontFamily,
                                minWidth: '2em'
                            }}
                            lineNumberContainerStyle={{
                                backgroundColor: theme === 'dark' ? '#171717' : '#f5f5f5',
                                float: 'left'
                            }}
                            wrapLongLines={isWrapped}
                            codeTagProps={{
                                style: {
                                    fontFamily: GeistMono.style.fontFamily,
                                    fontSize: '0.85em',
                                    whiteSpace: isWrapped ? 'pre-wrap' : 'pre',
                                    overflowWrap: isWrapped ? 'break-word' : 'normal',
                                    wordBreak: isWrapped ? 'break-word' : 'keep-all'
                                }
                            }}
                        >
                            {children}
                        </SyntaxHighlighter>
                    </div>
                </div>
            );
        };

        CodeBlock.displayName = 'CodeBlock';

        const LinkPreview = ({ href, title }: { href: string, title?: string }) => {
            const domain = new URL(href).hostname;

            return (
                <div className="flex flex-col bg-white dark:bg-neutral-800 text-xs m-0">
                    <div className="flex items-center h-6 space-x-1.5 px-2 pt-2 text-xs text-neutral-600 dark:text-neutral-300">
                        <Image
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                            alt=""
                            width={12}
                            height={12}
                            className="rounded-sm"
                        />
                        <span className="truncate font-medium">{domain}</span>
                    </div>
                    {title && (
                        <div className="px-2 pb-2 pt-1">
                            <h3 className="font-normal text-sm m-0 text-neutral-700 dark:text-neutral-200 line-clamp-3">
                                {title}
                            </h3>
                        </div>
                    )}
                </div>
            );
        };

        const renderHoverCard = (href: string, text: React.ReactNode, isCitation: boolean = false, citationText?: string) => {
            const title = citationText || (typeof text === 'string' ? text : '');
            
            return (
                <HoverCard openDelay={10}>
                    <HoverCardTrigger asChild>
                        <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={isCitation
                                ? "cursor-pointer text-xs text-primary py-0.5 px-1.5 m-0 bg-primary/10 dark:bg-primary/20 rounded-full no-underline font-medium"
                                : "text-primary dark:text-primary-light no-underline hover:underline font-medium"}
                        >
                            {text}
                        </Link>
                    </HoverCardTrigger>
                    <HoverCardContent
                        side="top"
                        align="start"
                        sideOffset={5}
                        className="w-56 p-0 shadow-sm border border-neutral-200 dark:border-neutral-700 rounded-md overflow-hidden"
                    >
                        <LinkPreview href={href} title={title} />
                    </HoverCardContent>
                </HoverCard>
            );
        };

        const generateKey = () => {
            return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        const renderer: Partial<ReactRenderer> = {
            text(text: string) {
                if (!text.includes('$')) return text;
                return (
                    <Latex
                        delimiters={[
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false }
                        ]}
                        key={generateKey()}
                    >
                        {text}
                    </Latex>
                );
            },
            paragraph(children) {
                const key = generateKey();
                if (typeof children === 'string' && children.includes('$')) {
                    return (
                        <p key={key} className="my-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
                            <Latex
                                delimiters={[
                                    { left: '$$', right: '$$', display: true },
                                    { left: '$', right: '$', display: false }
                                ]}
                                key={generateKey()}
                            >
                                {children}
                            </Latex>
                        </p>
                    );
                }
                return <p key={key} className="my-5 leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</p>;
            },
            code(children, language) {
                return <CodeBlock language={language} key={generateKey()}>{String(children)}</CodeBlock>;
            },
            link(href, text) {
                const citationIndex = citationLinks.findIndex(link => link.link === href);
                if (citationIndex !== -1) {
                    const citationText = citationLinks[citationIndex].text;
                    return (
                        <sup key={generateKey()}>
                            {renderHoverCard(href, citationIndex + 1, true, citationText)}
                        </sup>
                    );
                }
                // Potentially add key if renderHoverCard doesn't return a single element with a key
                return isValidUrl(href)
                    ? renderHoverCard(href, text)
                    : <a key={generateKey()} href={href} className="text-primary dark:text-primary-light hover:underline font-medium">{text}</a>;
            },
            heading(children, level) {
                const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
                const sizeClasses = {
                    1: "text-2xl md:text-3xl font-extrabold mt-8 mb-4",
                    2: "text-xl md:text-2xl font-bold mt-7 mb-3",
                    3: "text-lg md:text-xl font-semibold mt-6 mb-3",
                    4: "text-base md:text-lg font-medium mt-5 mb-2",
                    5: "text-sm md:text-base font-medium mt-4 mb-2",
                    6: "text-xs md:text-sm font-medium mt-4 mb-2",
                }[level] || "";

                return (
                    <HeadingTag key={generateKey()} className={`${sizeClasses} text-neutral-900 dark:text-neutral-50 tracking-tight`}>
                        {children}
                    </HeadingTag>
                );
            },
            list(children, ordered) {
                const ListTag = ordered ? 'ol' : 'ul';
                return (
                    <ListTag key={generateKey()} className={`my-5 pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 ${ordered ? 'list-decimal' : 'list-disc'}`}>
                        {children}
                    </ListTag>
                );
            },
            listItem(children) {
                // Add key to the <li> tag
                return <li key={generateKey()} className="pl-1 leading-relaxed">{children}</li>;
            },
            blockquote(children) {
                return (
                    <blockquote key={generateKey()} className="my-6 border-l-4 border-primary/30 dark:border-primary/20 pl-4 py-1 text-neutral-700 dark:text-neutral-300 italic bg-neutral-50 dark:bg-neutral-900/50 rounded-r-md">
                        {children}
                    </blockquote>
                );
            },
            table(children) {
                return (
                    <div key={generateKey()} className="w-full my-8 overflow-hidden">
                        <div className="overflow-x-auto rounded-sm border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                            <table className="w-full border-collapse text-sm m-0">
                                {children}
                            </table>
                        </div>
                    </div>
                );
            },
            tableRow(children) {
                // Add key to the <tr> tag
                return (
                    <tr key={generateKey()} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0 transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50">
                        {children}
                    </tr>
                );
            },
            tableCell(children, flags) {
                const align = flags.align ? `text-${flags.align}` : 'text-left';
                const isHeader = flags.header;
                const key = generateKey();

                return isHeader ? (
                    <th key={key} className={cn(
                        "px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100",
                        "bg-neutral-100/80 dark:bg-neutral-800/80",
                        "first:pl-6 last:pr-6",
                        align
                    )}>
                        {children}
                    </th>
                ) : (
                    <td key={key} className={cn(
                        "px-4 py-3 text-neutral-700 dark:text-neutral-300",
                        "first:pl-6 last:pr-6",
                        align
                    )}>
                        {children}
                    </td>
                );
            },
            tableHeader(children) {
                return (
                    <thead key={generateKey()} className="border-b border-neutral-200 dark:border-neutral-800">
                        {children}
                    </thead>
                );
            },
            tableBody(children) {
                return (
                    <tbody key={generateKey()} className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {children}
                    </tbody>
                );
            },
        };

        return (
            <div className="markdown-body prose prose-neutral dark:prose-invert max-w-none dark:text-neutral-200 font-sans">
                <Marked renderer={renderer}>
                    {content}
                </Marked>
            </div>
        );
    };


    const lastUserMessageIndex = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                return i;
            }
        }
        return -1;
    }, [messages]);

    useEffect(() => {
        // Reset manual scroll when streaming starts
        if (status === 'streaming') {
            setHasManuallyScrolled(false);
            // Initial scroll to bottom when streaming starts
            if (bottomRef.current) {
                isAutoScrollingRef.current = true;
                bottomRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [status]);

    useEffect(() => {
        let scrollTimeout: NodeJS.Timeout;

        const handleScroll = () => {
            // Clear any pending timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            // If we're not auto-scrolling and we're streaming, it must be a user scroll
            if (!isAutoScrollingRef.current && status === 'streaming') {
                const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
                if (!isAtBottom) {
                    setHasManuallyScrolled(true);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);

        // Auto-scroll on new content if we haven't manually scrolled
        if (status === 'streaming' && !hasManuallyScrolled && bottomRef.current) {
            scrollTimeout = setTimeout(() => {
                isAutoScrollingRef.current = true;
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                // Reset auto-scroll flag after animation
                setTimeout(() => {
                    isAutoScrollingRef.current = false;
                }, 100);
            }, 100);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
        };
    }, [messages, suggestedQuestions, status, hasManuallyScrolled]);

    const handleSuggestedQuestionClick = useCallback(async (question: string) => {
        setSuggestedQuestions([]);

        await append({
            content: question.trim(),
            role: 'user'
        });
    }, [append]);

    const handleMessageEdit = useCallback((index: number) => {
        setIsEditingMessage(true);
        setEditingMessageIndex(index);
        setInput(messages[index].content);
    }, [messages, setInput]);

    const handleMessageUpdate = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (input.trim()) {
            // Create new messages array up to the edited message
            const newMessages = messages.slice(0, editingMessageIndex + 1);
            // Update the edited message
            newMessages[editingMessageIndex] = { ...newMessages[editingMessageIndex], content: input.trim() };
            // Set the new messages array
            setMessages(newMessages);
            // Reset editing state
            setIsEditingMessage(false);
            setEditingMessageIndex(-1);
            // Store the edited message for reference
            lastSubmittedQueryRef.current = input.trim();
            // Clear input
            setInput('');
            // Reset suggested questions
            setSuggestedQuestions([]);
            // Trigger a new chat completion without appending
            reload();
        } else {
            toast.error("Please enter a valid message.");
        }
    }, [input, messages, editingMessageIndex, setMessages, setInput, reload]);

    const AboutButton = () => {
        return (
            <Link href="/about">
                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full w-8 h-8 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                >
                    <Info className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </Button>
            </Link>
        );
    };

    interface NavbarProps { }

    const Navbar: React.FC<NavbarProps> = () => {
        return (
            <div className={cn(
                "fixed top-0 left-0 right-0 z-[60] flex justify-between items-center px-4 py-3",
                "border-b border-neutral-200 dark:border-neutral-800",
                // Add opaque background only after submit
                status === 'ready' ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" : "bg-background",
            )}>
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Mountain size={18} className="text-primary" />
                        </div>
                        <span className="font-syne font-semibold text-lg hidden sm:inline text-neutral-900 dark:text-neutral-100">
                            SimpleTripAdvisor
                        </span>
                    </Link>
                    
                    <div className="hidden sm:flex h-6 mx-2 border-l border-neutral-200 dark:border-neutral-700" />
                    
                    <Link href="/new">
                        <Button
                            type="button"
                            variant={'secondary'}
                            className="rounded-full bg-accent hover:bg-accent/80 backdrop-blur-sm group transition-all hover:scale-105"
                        >
                            <Plus size={16} className="group-hover:rotate-90 transition-all" />
                            <span className="text-sm ml-2 sm:inline hidden">
                                New Trip
                            </span>
                        </Button>
                    </Link>
                </div>
    
                <div className='flex items-center space-x-3'>
                    <Button
                        type="button"
                        variant={'secondary'}
                        className="rounded-full bg-accent hover:bg-accent/80 backdrop-blur-sm group transition-all hover:scale-105"
                    >
                        <Plane size={16} className="group-hover:rotate-90 transition-all" />
                        <span className="text-sm ml-2 sm:inline hidden">
                            My Trips
                        </span>
                    </Button>
                    <ThemeToggle />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full w-8 h-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        <User2 className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                    </Button>
                </div>
            </div>
        );
    };

    const handleModelChange = useCallback((newModel: string) => {
        setSelectedModel(newModel);
    }, []);

    const resetSuggestedQuestions = useCallback(() => {
        setSuggestedQuestions([]);
    }, []);


    const memoizedMessages = useMemo(() => {
        // Create a shallow copy
        const msgs = [...messages];

        return msgs.filter((message) => {
            // Keep all user messages
            if (message.role === 'user') return true;

            // For assistant messages
            if (message.role === 'assistant') {
                // Keep messages that have tool invocations
                if (message.parts?.some(part => part.type === 'tool-invocation')) {
                    return true;
                }
                // Keep messages that have text parts but no tool invocations
                if (message.parts?.some(part => part.type === 'text') ||
                    !message.parts?.some(part => part.type === 'tool-invocation')) {
                    return true;
                }
                return false;
            }
            return false;
        });
    }, [messages]);

    // Track visibility state for each reasoning section using messageIndex-partIndex as key
    const [reasoningVisibilityMap, setReasoningVisibilityMap] = useState<Record<string, boolean>>({});

    const handleRegenerate = useCallback(async () => {
        if (status !== 'ready') {
            toast.error("Please wait for the current response to complete!");
            return;
        }

        const lastUserMessage = messages.findLast(m => m.role === 'user');
        if (!lastUserMessage) return;

        // Remove the last assistant message
        const newMessages = messages.slice(0, -1);
        setMessages(newMessages);
        setSuggestedQuestions([]);

        // Resubmit the last user message
        await reload();
    }, [status, messages, setMessages, reload]);

    // Add this type at the top with other interfaces
    type MessagePart = TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart;

    // Update the renderPart function signature
    const renderPart = (
        part: MessagePart,
        messageIndex: number,
        partIndex: number,
        parts: MessagePart[],
        message: any,
    ) => {
        if (part.type === "text" && partIndex === 0 &&
            parts.some((p, i) => i > partIndex && p.type === 'tool-invocation')) {
            return null;
        }

        switch (part.type) {
            case "text":
                if (part.text.trim() === "" || part.text === null || part.text === undefined || !part.text) {
                    return null;
                }
                return (
                    <div key={`${messageIndex}-${partIndex}-text`}>
                        <div className="flex items-center justify-between mt-5 mb-2">
                            <div className="flex items-center gap-2">
                                <Mountain className='size-6 invert-0 dark:invert' width={100} height={100}/>
                                <h2 className="text-lg font-semibold font-syne text-neutral-800 dark:text-neutral-200">
                                    SimpleTripAdvisor AI
                                </h2>
                            </div>
                            {status === 'ready' && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRegenerate()}
                                        className="h-8 px-2 text-xs rounded-full"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <CopyButton text={part.text} />
                                </div>
                            )}
                        </div>
                        <MarkdownRenderer content={preprocessLaTeX(part.text)} />
                    </div>
                );
            case "reasoning": {
                const sectionKey = `${messageIndex}-${partIndex}`;
                const isComplete = parts[partIndex + 1]?.type === "text";
                const timing = reasoningTimings[sectionKey];
                const duration = timing?.endTime ? ((timing.endTime - timing.startTime) / 1000).toFixed(1) : null;

                return (
                    <motion.div
                        key={`${messageIndex}-${partIndex}-reasoning`}
                        id={`reasoning-${messageIndex}`}
                        className="my-4"
                    >
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                            <button
                                onClick={() => setReasoningVisibilityMap(prev => ({
                                    ...prev,
                                    [sectionKey]: !prev[sectionKey]
                                }))}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3",
                                    "bg-neutral-50 dark:bg-neutral-900",
                                    "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                                    "transition-colors duration-200",
                                    "group text-left"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative flex items-center justify-center size-2">
                                        <div className="relative flex items-center justify-center size-2">
                                            {isComplete ? (
                                                <div className="size-1.5 rounded-full bg-emerald-500" />
                                            ) : (
                                                <>
                                                    <div className="size-1.5 rounded-full bg-[#007AFF]/30 animate-ping" />
                                                    <div className="size-1.5 rounded-full bg-[#007AFF] absolute" />
                                                </>
                                            )}
                                        </div>
                                        {!isComplete && (
                                            <div className="absolute inset-0 rounded-full border-2 border-[#007AFF]/20 animate-ping" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                            {isComplete ? "Reasoned" : "Reasoning"}
                                        </span>
                                        {duration && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                                                <PhosphorClock weight="regular" className="size-3 text-neutral-500" />
                                                <span className="text-[10px] tabular-nums font-medium text-neutral-500">
                                                    {duration}s
                                                </span>
                                            </div>
                                        )}
                                        {!isComplete && liveElapsedTimes[sectionKey] && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                                                <PhosphorClock weight="regular" className="size-3 text-neutral-500" />
                                                <span className="text-[10px] tabular-nums font-medium text-neutral-500">
                                                    {liveElapsedTimes[sectionKey].toFixed(1)}s
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isComplete && (
                                        <div className="flex items-center gap-[3px] px-2 py-1">
                                            {[...Array(3)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="size-1 rounded-full bg-primary/60 animate-pulse"
                                                    style={{ animationDelay: `${i * 200}ms` }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <ChevronDown
                                        className={cn(
                                            "size-4 text-neutral-400 transition-transform duration-200",
                                            reasoningVisibilityMap[sectionKey] ? "rotate-180" : ""
                                        )}
                                    />
                                </div>
                            </button>

                            <AnimatePresence>
                                {reasoningVisibilityMap[sectionKey] && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-t border-neutral-200 dark:border-neutral-800"
                                    >
                                        <div className="p-4 bg-white dark:bg-neutral-900">
                                            <div className={cn(
                                                "text-sm text-neutral-600 dark:text-neutral-400",
                                                "prose prose-neutral dark:prose-invert max-w-none",
                                                "prose-p:my-2 prose-p:leading-relaxed"
                                            )}>
                                                {part.details ? (
                                                    <div className="whitespace-pre-wrap">
                                                        {part.details.map((detail, detailIndex) => (
                                                            <div key={detailIndex}>
                                                                {detail.type === 'text' ? (
                                                                    <div className="text-sm font-sans leading-relaxed break-words whitespace-pre-wrap">
                                                                        {detail.text}
                                                                    </div>
                                                                ) : (
                                                                    '<redacted>'
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : part.reasoning ? (
                                                    <div className="text-sm font-sans leading-relaxed break-words whitespace-pre-wrap">
                                                        {part.reasoning}
                                                    </div>
                                                ) : (
                                                    <div className="text-neutral-500 italic">No reasoning details available</div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                );
            }
            case "tool-invocation":
                return (
                    <ToolInvocationListView
                        key={`${messageIndex}-${partIndex}-tool`}
                        toolInvocations={[part.toolInvocation]}
                        message={message}
                    />
                );
            default:
                return null;
        }
    };

    // Add near other state declarations in HomeContent
    interface ReasoningTiming {
        startTime: number;
        endTime?: number;
    }

    const [reasoningTimings, setReasoningTimings] = useState<Record<string, ReasoningTiming>>({});

    // Add state for tracking live elapsed time
    const [liveElapsedTimes, setLiveElapsedTimes] = useState<Record<string, number>>({});

    // Update live elapsed time for active reasoning sections
    useEffect(() => {
        const activeReasoningSections = Object.entries(reasoningTimings)
            .filter(([_, timing]) => !timing.endTime);

        if (activeReasoningSections.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimes: Record<string, number> = {};

            activeReasoningSections.forEach(([key, timing]) => {
                updatedTimes[key] = (now - timing.startTime) / 1000;
            });

            setLiveElapsedTimes(prev => ({
                ...prev,
                ...updatedTimes
            }));
        }, 100);

        return () => clearInterval(interval);
    }, [reasoningTimings]);

    useEffect(() => {
        messages.forEach((message, messageIndex) => {
            message.parts?.forEach((part, partIndex) => {
                if (part.type === "reasoning") {
                    const sectionKey = `${messageIndex}-${partIndex}`;
                    const isComplete = message.parts[partIndex + 1]?.type === "text";

                    if (!reasoningTimings[sectionKey]) {
                        setReasoningTimings(prev => ({
                            ...prev,
                            [sectionKey]: { startTime: Date.now() }
                        }));
                    } else if (isComplete && !reasoningTimings[sectionKey].endTime) {
                        setReasoningTimings(prev => ({
                            ...prev,
                            [sectionKey]: {
                                ...prev[sectionKey],
                                endTime: Date.now()
                            }
                        }));
                    }
                }
            });
        });
    }, [messages, reasoningTimings]);

    const WidgetSection = memo(() => {
        const [currentTime, setCurrentTime] = useState(new Date());
        const timerRef = useRef<NodeJS.Timeout>();

        useEffect(() => {
            // Sync with the nearest second
            const now = new Date();
            const delay = 1000 - now.getMilliseconds();

            // Initial sync
            const timeout = setTimeout(() => {
                setCurrentTime(new Date());

                // Then start the interval
                timerRef.current = setInterval(() => {
                    setCurrentTime(new Date());
                }, 1000);
            }, delay);

            return () => {
                clearTimeout(timeout);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }, []);

        // Get user's timezone
        const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Format date and time with timezone
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: timezone
        });

        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        });

        const formattedDate = dateFormatter.format(currentTime);
        const formattedTime = timeFormatter.format(currentTime);

        const handleDateTimeClick = useCallback(() => {
            if (status !== 'ready') return;

            append({
                content: `What's the current date and time?`,
                role: 'user'
            });

            lastSubmittedQueryRef.current = `What's the current date and time?`;
            setHasSubmitted(true);
        }, []);

        return (
            <div className="mt-8 w-full">
                <div className="flex flex-wrap gap-3 justify-center">
                    {/* Time Widget */}
                    <Button
                        variant="outline"
                        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:shadow-sm transition-all h-auto"
                        onClick={handleDateTimeClick}
                    >
                        <PhosphorClock weight="duotone" className="h-5 w-5 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                            {formattedTime}
                        </span>
                    </Button>

                    {/* Date Widget */}
                    <Button
                        variant="outline"
                        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:shadow-sm transition-all h-auto"
                        onClick={handleDateTimeClick}
                    >
                        <CalendarBlank weight="duotone" className="h-5 w-5 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                            {formattedDate}
                        </span>
                    </Button>
                </div>
            </div>
        );
    });

    WidgetSection.displayName = 'WidgetSection';

    return (
        <div className="flex flex-col !font-sans items-center min-h-screen bg-background text-foreground transition-all duration-500">
            <Navbar />

            <div className={`w-full p-2 sm:p-4 ${status === 'ready' && messages.length === 0
                ? 'min-h-screen flex flex-col items-center justify-center' // Center everything when no messages
                : 'mt-20 sm:mt-16' // Add top margin when showing messages
                }`}>
                <div className={`w-full max-w-[90%] !font-sans sm:max-w-2xl space-y-6 p-0 mx-auto transition-all duration-300`}>
                    {status === 'ready' && messages.length === 0 && (
                        <div className="text-center !font-sans">
                            <h1 className="text-2xl sm:text-4xl mb-6 text-neutral-800 dark:text-neutral-100 font-syne">
                                Ready to start a trip?
                            </h1>
                        </div>
                    )}
                    <AnimatePresence>
                        {messages.length === 0 && !hasSubmitted && (
                            <motion.div
                                initial={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.5 }}
                                className={cn('!mt-4')}
                            >
                                <FormComponent
                                    input={input}
                                    setInput={setInput}
                                    attachments={attachments}
                                    setAttachments={setAttachments}
                                    handleSubmit={handleSubmit}
                                    fileInputRef={fileInputRef}
                                    inputRef={inputRef}
                                    stop={stop}
                                    messages={messages as any}
                                    append={append}
                                    selectedModel={selectedModel}
                                    setSelectedModel={handleModelChange}
                                    resetSuggestedQuestions={resetSuggestedQuestions}
                                    lastSubmittedQueryRef={lastSubmittedQueryRef}
                                    selectedGroup={selectedGroup}
                                    setSelectedGroup={setSelectedGroup}
                                    showExperimentalModels={true}
                                    status={status}
                                    setHasSubmitted={setHasSubmitted}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Add the widget section below form when no messages */}
                    {messages.length === 0 && (
                        <div>
                            <WidgetSection />
                        </div>
                    )}

                    <div className="space-y-4 sm:space-y-6 mb-32">
                        {memoizedMessages.map((message, index) => (
                            <div key={index} className={`${
                                // Add border only if this is an assistant message AND there's a next message
                                message.role === 'assistant' && index < memoizedMessages.length - 1
                                    ? '!mb-12 border-b border-neutral-200 dark:border-neutral-800'
                                    : ''
                                }`.trim()}>
                                {message.role === 'user' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="mb-4 px-0"
                                    >
                                        <div className="flex-grow min-w-0">
                                            {isEditingMessage && editingMessageIndex === index ? (
                                                <form onSubmit={handleMessageUpdate} className="w-full">
                                                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                                        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                                                Edit Query
                                                            </span>
                                                            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-[9px] border border-neutral-200 dark:border-neutral-700 flex items-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setIsEditingMessage(false);
                                                                        setEditingMessageIndex(-1);
                                                                        setInput('');
                                                                    }}
                                                                    className="h-7 w-7 !rounded-l-lg !rounded-r-none text-neutral-500 dark:text-neutral-400 hover:text-primary"
                                                                    disabled={status === 'submitted' || status === 'streaming'}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                                <Separator orientation="vertical" className="h-7 bg-neutral-200 dark:bg-neutral-700" />
                                                                <Button
                                                                    type="submit"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 !rounded-r-lg !rounded-l-none text-neutral-500 dark:text-neutral-400 hover:text-primary"
                                                                    disabled={status === 'submitted' || status === 'streaming'}
                                                                >
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <textarea
                                                                value={input}
                                                                onChange={(e) => setInput(e.target.value)}
                                                                rows={3}
                                                                className="w-full resize-none rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                                placeholder="Edit your message..."
                                                            />
                                                        </div>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="group relative">
                                                    <div className="relative">
                                                        <p className="text-xl font-medium font-sans break-words text-neutral-900 dark:text-neutral-100 pr-10 sm:pr-12">
                                                            {message.content}
                                                        </p>
                                                        {!isEditingMessage && index === lastUserMessageIndex && (
                                                            <div className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent rounded-[9px] border border-neutral-200 dark:border-neutral-700 flex items-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleMessageEdit(index)}
                                                                    className="h-7 w-7 !rounded-l-lg !rounded-r-none text-neutral-500 dark:text-neutral-400 hover:text-primary"
                                                                    disabled={status === 'submitted' || status === 'streaming'}
                                                                >
                                                                    <svg
                                                                        width="15"
                                                                        height="15"
                                                                        viewBox="0 0 15 15"
                                                                        fill="none"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        className="h-4 w-4"
                                                                    >
                                                                        <path
                                                                            d="M12.1464 1.14645C12.3417 0.951184 12.6583 0.951184 12.8535 1.14645L14.8535 3.14645C15.0488 3.34171 15.0488 3.65829 14.8535 3.85355L10.9109 7.79618C10.8349 7.87218 10.7471 7.93543 10.651 7.9835L6.72359 9.94721C6.53109 10.0435 6.29861 10.0057 6.14643 9.85355C5.99425 9.70137 5.95652 9.46889 6.05277 9.27639L8.01648 5.34897C8.06455 5.25283 8.1278 5.16507 8.2038 5.08907L12.1464 1.14645ZM12.5 2.20711L8.91091 5.79618L7.87266 7.87267L9.94915 6.83442L13.5382 3.24535L12.5 2.20711ZM8.99997 1.49997C9.27611 1.49997 9.49997 1.72383 9.49997 1.99997C9.49997 2.27611 9.27611 2.49997 8.99997 2.49997H4.49997C3.67154 2.49997 2.99997 3.17154 2.99997 3.99997V11C2.99997 11.8284 3.67154 12.5 4.49997 12.5H11.5C12.3284 12.5 13 11.8284 13 11V6.49997C13 6.22383 13.2238 5.99997 13.5 5.99997C13.7761 5.99997 14 6.22383 14 6.49997V11C14 12.3807 12.8807 13.5 11.5 13.5H4.49997C3.11926 13.5 1.99997 12.3807 1.99997 11V3.99997C1.99997 2.61926 3.11926 1.49997 4.49997 1.49997H8.99997Z"
                                                                            fill="currentColor"
                                                                            fillRule="evenodd"
                                                                            clipRule="evenodd"
                                                                        />
                                                                    </svg>
                                                                </Button>
                                                                <Separator orientation="vertical" className="h-7" />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(message.content);
                                                                        toast.success("Copied to clipboard");
                                                                    }}
                                                                    className="h-7 w-7 !rounded-r-lg !rounded-l-none text-neutral-500 dark:text-neutral-400 hover:text-primary"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {message.experimental_attachments && message.experimental_attachments.length > 0 && (
                                                        <AttachmentsBadge attachments={message.experimental_attachments} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {message.role === 'assistant' && (
                                    <>
                                        {message.parts?.map((part, partIndex) =>
                                            renderPart(
                                                part as MessagePart,
                                                index,
                                                partIndex,
                                                message.parts as MessagePart[],
                                                message,
                                            )
                                        )}
                                        
                                        {/* Add suggested questions if this is the last message and it's from the assistant */}
                                        {index === memoizedMessages.length - 1 && suggestedQuestions.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{ duration: 0.5 }}
                                                className="w-full max-w-xl sm:max-w-2xl mt-6"
                                            >
                                                <div className="flex items-center gap-2 mb-4">
                                                    <AlignLeft className="w-5 h-5 text-primary" />
                                                    <h2 className="font-semibold text-base text-neutral-800 dark:text-neutral-200">Suggested questions</h2>
                                                </div>
                                                <div className="space-y-2 flex flex-col">
                                                    {suggestedQuestions.map((question, index) => (
                                                        <Button
                                                            key={index}
                                                            variant="ghost"
                                                            className="w-fit font-medium rounded-2xl p-1 justify-start text-left h-auto py-2 px-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 whitespace-normal"
                                                            onClick={() => handleSuggestedQuestionClick(question)}
                                                        >
                                                            {question}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div ref={bottomRef} />
                </div>

                <AnimatePresence>
                    {(messages.length > 0 || hasSubmitted) && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.5 }}
                            className="fixed bottom-4 left-0 right-0 w-full max-w-[90%] sm:max-w-2xl mx-auto z-20"
                        >
                            <FormComponent
                                input={input}
                                setInput={setInput}
                                attachments={attachments}
                                setAttachments={setAttachments}
                                handleSubmit={handleSubmit}
                                fileInputRef={fileInputRef}
                                inputRef={inputRef}
                                stop={stop}
                                messages={messages as any}
                                append={append}
                                selectedModel={selectedModel}
                                setSelectedModel={handleModelChange}
                                resetSuggestedQuestions={resetSuggestedQuestions}
                                lastSubmittedQueryRef={lastSubmittedQueryRef}
                                selectedGroup={selectedGroup}
                                setSelectedGroup={setSelectedGroup}
                                showExperimentalModels={false}
                                status={status}
                                setHasSubmitted={setHasSubmitted}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
        <div className="flex flex-col items-center gap-6 p-8">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-neutral-800" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 animate-pulse">
                Loading...
            </p>
        </div>
    </div>
);

const ToolInvocationListView = memo(
    ({ toolInvocations, message }: { toolInvocations: ToolInvocation[]; message: any }) => {
        const renderToolInvocation = useCallback(
            (toolInvocation: ToolInvocation, index: number) => {
                const args = JSON.parse(JSON.stringify(toolInvocation.args));
                const result = 'result' in toolInvocation ? JSON.parse(JSON.stringify(toolInvocation.result)) : null;

                if (toolInvocation.toolName === 'find_place') {
                    if (!result) {
                        return <SearchLoadingState
                            icon={MapPin}
                            text="Finding locations..."
                            color="blue"
                        />;
                    }

                    const { features } = result;
                    if (!features || features.length === 0) return null;

                    return (
                        <Card className="w-full my-4 overflow-hidden bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                            <div className="relative w-full h-[60vh]">
                                <div className="absolute top-4 left-4 z-10 flex gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="bg-white/90 dark:bg-black/90 backdrop-blur-sm"
                                    >
                                        {features.length} Locations Found
                                    </Badge>
                                </div>

                                <MapComponent
                                    center={{
                                        lat: features[0].geometry.coordinates[1],
                                        lng: features[0].geometry.coordinates[0],
                                    }}
                                    places={features.map((feature: any) => ({
                                        name: feature.name,
                                        location: {
                                            lat: feature.geometry.coordinates[1],
                                            lng: feature.geometry.coordinates[0],
                                        },
                                        vicinity: feature.formatted_address,
                                    }))}
                                    zoom={features.length > 1 ? 12 : 15}
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto border-t border-neutral-200 dark:border-neutral-800">
                                {features.map((place: any, index: any) => {
                                    const isGoogleResult = place.source === 'google';

                                    return (
                                        <div
                                            key={place.id || index}
                                            className={cn(
                                                "p-4",
                                                index !== features.length - 1 && "border-b border-neutral-200 dark:border-neutral-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                                    {place.feature_type === 'street_address' || place.feature_type === 'street' ? (
                                                        <RoadHorizon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                    ) : place.feature_type === 'locality' ? (
                                                        <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                                        {place.name}
                                                    </h3>
                                                    {place.formatted_address && (
                                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                                            {place.formatted_address}
                                                        </p>
                                                    )}
                                                    <Badge variant="secondary" className="mt-2">
                                                        {place.feature_type.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>

                                                <div className="flex gap-2">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        const coords = `${place.geometry.coordinates[1]},${place.geometry.coordinates[0]}`;
                                                                        navigator.clipboard.writeText(coords);
                                                                        toast.success("Coordinates copied!");
                                                                    }}
                                                                    className="h-10 w-10"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Copy Coordinates</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>

                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        const url = isGoogleResult
                                                                            ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                                                                            : `https://www.google.com/maps/search/?api=1&query=${place.geometry.coordinates[1]},${place.geometry.coordinates[0]}`;
                                                                        window.open(url, '_blank');
                                                                    }}
                                                                    className="h-10 w-10"
                                                                >
                                                                    <ExternalLink className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View in Maps</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    );
                }

                if (toolInvocation.toolName === 'nearby_search') {
                    if (!result) {
                        return (
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-neutral-700 dark:text-neutral-300 animate-pulse" />
                                    <span className="text-neutral-700 dark:text-neutral-300 text-lg">
                                        Finding nearby {args.type}...
                                    </span>
                                </div>
                                <motion.div className="flex space-x-1">
                                    {[0, 1, 2].map((index) => (
                                        <motion.div
                                            key={index}
                                            className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full"
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                                delay: index * 0.2,
                                                repeatType: "reverse",
                                            }}
                                        />
                                    ))}
                                </motion.div>
                            </div>
                        );
                    }

                    console.log(result);

                    return (
                        <div className="my-4">
                            <NearbySearchMapView
                                center={result.center}
                                places={result.results}
                                type={args.type}
                            />
                        </div>
                    );
                }

                if (toolInvocation.toolName === 'text_search') {
                    if (!result) {
                        return (
                            <div className="flex items-center justify-between w-full">
                                <div className='flex items-center gap-2'>
                                    <MapPin className="h-5 w-5 text-neutral-700 dark:text-neutral-300 animate-pulse" />
                                    <span className="text-neutral-700 dark:text-neutral-300 text-lg">Searching places...</span>
                                </div>
                                <motion.div className="flex space-x-1">
                                    {[0, 1, 2].map((index) => (
                                        <motion.div
                                            key={index}
                                            className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full"
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                                delay: index * 0.2,
                                                repeatType: "reverse",
                                            }}
                                        />
                                    ))}
                                </motion.div>
                            </div>
                        );
                    }

                    const centerLocation = result.results[0]?.geometry?.location;
                    return (
                        <MapContainer
                            title="Search Results"
                            center={centerLocation}
                            places={result.results.map((place: any) => ({
                                name: place.name,
                                location: place.geometry.location,
                                vicinity: place.formatted_address
                            }))}
                        />
                    );
                }

                if (toolInvocation.toolName === 'get_weather_data') {
                    if (!result) {
                        return (
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Cloud className="h-5 w-5 text-neutral-700 dark:text-neutral-300 animate-pulse" />
                                    <span className="text-neutral-700 dark:text-neutral-300 text-lg">Fetching weather data...</span>
                                </div>
                                <div className="flex space-x-1">
                                    {[0, 1, 2].map((index) => (
                                        <motion.div
                                            key={index}
                                            className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full"
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                                delay: index * 0.2,
                                                repeatType: "reverse",
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    }
                    return <WeatherChart result={result} />;
                }

                if (toolInvocation.toolName === 'currency_converter') {
                    return <CurrencyConverter toolInvocation={toolInvocation} result={result} />;
                }

                if (toolInvocation.toolName === 'reason_search') {
                    const updates = message?.annotations?.filter((a: any) =>
                        a.type === 'research_update'
                    ).map((a: any) => a.data);
                    return <ReasonSearch updates={updates || []} />;
                }

                if (toolInvocation.toolName === 'web_search') {
                    return (
                        <div className="mt-4">
                            <MultiSearch
                                result={result}
                                args={args}
                                annotations={message?.annotations?.filter(
                                    (a: any) => a.type === 'query_completion'
                                ) || []}
                            />
                        </div>
                    );
                }

                if (toolInvocation.toolName === 'retrieve') {
                    if (!result) {
                        return (
                            <div className="border border-neutral-200 rounded-xl my-4 p-4 dark:border-neutral-800 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-900/90">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-10 h-10">
                                        <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                                        <Globe className="h-5 w-5 text-primary/70 absolute inset-0 m-auto" />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-36 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-md" />
                                        <div className="space-y-1.5">
                                            <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-800/50 animate-pulse rounded-md" />
                                            <div className="h-3 w-2/3 bg-neutral-100 dark:bg-neutral-800/50 animate-pulse rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Update the error message UI with better dark mode border visibility
                    if (result.error || (result.results && result.results[0] && result.results[0].error)) {
                        const errorMessage = result.error || (result.results && result.results[0] && result.results[0].error);
                        return (
                            <div className="border border-red-200 dark:border-red-500 rounded-xl my-4 p-4 bg-red-50 dark:bg-red-950/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                                        <Globe className="h-4 w-4 text-red-600 dark:text-red-300" />
                                    </div>
                                    <div>
                                        <div className="text-red-700 dark:text-red-300 text-sm font-medium">
                                            Error retrieving content
                                        </div>
                                        <div className="text-red-600/80 dark:text-red-400/80 text-xs mt-1">
                                            {errorMessage}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Update the "no content" message UI with better dark mode border visibility
                    if (!result.results || result.results.length === 0) {
                        return (
                            <div className="border border-amber-200 dark:border-amber-500 rounded-xl my-4 p-4 bg-amber-50 dark:bg-amber-950/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                                        <Globe className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                                    </div>
                                    <div className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                                        No content available
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Existing rendering for successful retrieval:
                    return (
                        <div className="border border-neutral-200 rounded-xl my-4 overflow-hidden dark:border-neutral-800 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-900/90">
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative w-10 h-10 flex-shrink-0">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-lg" />
                                        <img
                                            className="h-5 w-5 absolute inset-0 m-auto"
                                            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(result.results[0].url)}`}
                                            alt=""
                                            onError={(e) => {
                                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2.29-2.333A17.9 17.9 0 0 1 8.027 13H4.062a8.008 8.008 0 0 0 5.648 6.667zM10.03 13c.151 2.439.848 4.73 1.97 6.752A15.905 15.905 0 0 0 13.97 13h-3.94zm9.908 0h-3.965a17.9 17.9 0 0 1-1.683 6.667A8.008 8.008 0 0 0 19.938 13zM4.062 11h3.965A17.9 17.9 0 0 1 9.71 4.333 8.008 8.008 0 0 0 4.062 11zm5.969 0h3.938A15.905 15.905 0 0 0 12 4.248 15.905 15.905 0 0 0 10.03 11zm4.259-6.667A17.9 17.9 0 0 1 15.938 11h3.965a8.008 8.008 0 0 0-5.648-6.667z' fill='rgba(128,128,128,0.5)'/%3E%3C/svg%3E";
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <h2 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                                            {result.results[0].title || 'Retrieved Content'}
                                        </h2>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                                            {result.results[0].description || 'No description available'}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                                {result.results[0].language || 'Unknown'}
                                            </span>
                                            <a
                                                href={result.results[0].url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View source
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-neutral-200 dark:border-neutral-800">
                                <details className="group">
                                    <summary className="w-full px-4 py-2 cursor-pointer text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TextIcon className="h-4 w-4 text-neutral-400" />
                                            <span>View content</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                                    </summary>
                                    <div className="max-h-[50vh] overflow-y-auto p-4 bg-neutral-50/50 dark:bg-neutral-800/30">
                                        <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none">
                                            <ReactMarkdown>{result.results[0].content || 'No content available'}</ReactMarkdown>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>
                    );
                }

                if (toolInvocation.toolName === 'track_flight') {
                    if (!result) {
                        return (
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Plane className="h-5 w-5 text-neutral-700 dark:text-neutral-300 animate-pulse" />
                                    <span className="text-neutral-700 dark:text-neutral-300 text-lg">Tracking flight...</span>
                                </div>
                                <div className="flex space-x-1">
                                    {[0, 1, 2].map((index) => (
                                        <motion.div
                                            key={index}
                                            className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full"
                                            initial={{ opacity: 0.3 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                                delay: index * 0.2,
                                                repeatType: "reverse",
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    }

                    if (result.error) {
                        return (
                            <div className="text-red-500 dark:text-red-400">
                                Error tracking flight: {result.error}
                            </div>
                        );
                    }

                    return (
                        <div className="my-4">
                            <FlightTracker data={result} />
                        </div>
                    );
                }

                if (toolInvocation.toolName === 'datetime') {
                    if (!result) {
                        return (
                            <div className="flex items-center gap-3 py-4 px-2">
                                <div className="h-5 w-5 relative">
                                    <div className="absolute inset-0 rounded-full border-2 border-neutral-300 dark:border-neutral-700 border-t-blue-500 dark:border-t-blue-400 animate-spin" />
                                </div>
                                <span className="text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                                    Fetching current time...
                                </span>
                            </div>
                        );
                    }

                    // Live Clock component that updates every second
                    const LiveClock = memo(() => {
                        const [time, setTime] = useState(() => new Date());
                        const timerRef = useRef<NodeJS.Timeout>();

                        useEffect(() => {
                            // Sync with the nearest second
                            const now = new Date();
                            const delay = 1000 - now.getMilliseconds();

                            // Initial sync
                            const timeout = setTimeout(() => {
                                setTime(new Date());

                                // Then start the interval
                                timerRef.current = setInterval(() => {
                                    setTime(new Date());
                                }, 1000);
                            }, delay);

                            return () => {
                                clearTimeout(timeout);
                                if (timerRef.current) {
                                    clearInterval(timerRef.current);
                                }
                            };
                        }, []);

                        // Format the time according to the specified timezone
                        const timezone = result.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
                        const formatter = new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric',
                            hour12: true,
                            timeZone: timezone
                        });

                        const formattedParts = formatter.formatToParts(time);
                        const timeParts = {
                            hour: formattedParts.find(part => part.type === 'hour')?.value || '12',
                            minute: formattedParts.find(part => part.type === 'minute')?.value || '00',
                            second: formattedParts.find(part => part.type === 'second')?.value || '00',
                            dayPeriod: formattedParts.find(part => part.type === 'dayPeriod')?.value || 'AM'
                        };

                        return (
                            <div className="mt-3">
                                <div className="flex items-baseline">
                                    <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                                        {timeParts.hour.padStart(2, '0')}
                                    </div>
                                    <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">:</div>
                                    <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                                        {timeParts.minute.padStart(2, '0')}
                                    </div>
                                    <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">:</div>
                                    <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                                        {timeParts.second.padStart(2, '0')}
                                    </div>
                                    <div className="ml-2 sm:ml-4 text-xl sm:text-2xl font-light self-center text-neutral-400 dark:text-neutral-500">
                                        {timeParts.dayPeriod}
                                    </div>
                                </div>
                            </div>
                        );
                    });

                    LiveClock.displayName = 'LiveClock';

                    return (
                        <div className="w-full my-6">
                            <div className="bg-white dark:bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                                <div className="p-5 sm:p-6 md:p-8">
                                    <div className="flex flex-col gap-6 sm:gap-8 md:gap-10">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
                                                    Current Time
                                                </h3>
                                                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-md px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 font-medium flex items-center gap-1.5">
                                                    <PhosphorClock weight="regular" className="h-3 w-3 text-blue-500" />
                                                    {result.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone}
                                                </div>
                                            </div>
                                            <LiveClock />
                                        </div>

                                        <div>
                                            <h3 className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400 tracking-wider uppercase mb-2">
                                                Today&apos;s Date
                                            </h3>
                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 md:gap-6">
                                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-neutral-900 dark:text-white">
                                                    {result.formatted.dateShort}
                                                </h2>
                                                <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-500">
                                                    {result.formatted.date}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }

                return null;
            },
            [message]
        );

        return (
            <>
                {toolInvocations.map(
                    (toolInvocation: ToolInvocation, toolIndex: number) => (
                        <div key={`tool-${toolIndex}`}>
                            {renderToolInvocation(toolInvocation, toolIndex)}
                        </div>
                    )
                )}
            </>
        );
    },
    (prevProps, nextProps) => {
        return prevProps.toolInvocations === nextProps.toolInvocations &&
            prevProps.message === nextProps.message;
    }
);

ToolInvocationListView.displayName = 'ToolInvocationListView';

const AttachmentsBadge = ({ attachments }: { attachments: any[] }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const imageAttachments = attachments.filter(att => att.contentType?.startsWith('image/'));
    
    if (imageAttachments.length === 0) return null;
    
    return (
        <>
            <div className="mt-2 flex flex-wrap gap-2">
                {imageAttachments.map((attachment, i) => {
                    // Truncate filename to 15 characters
                    const fileName = attachment.name || `Image ${i + 1}`;
                    const truncatedName = fileName.length > 15 
                        ? fileName.substring(0, 12) + '...' 
                        : fileName;
                    
                    return (
                        <button 
                            key={i}
                            onClick={() => {
                                setSelectedIndex(i);
                                setIsOpen(true);
                            }}
                            className="flex items-center gap-1.5 max-w-xs rounded-full pl-1 pr-3 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0">
                                <img 
                                    src={attachment.url} 
                                    alt={fileName}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                                {truncatedName}
                            </span>
                        </button>
                    );
                })}
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="p-0 bg-white dark:bg-neutral-900 sm:max-w-4xl">
                    <div className="flex flex-col h-full">
                        <header className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        navigator.clipboard.writeText(imageAttachments[selectedIndex].url);
                                        toast.success("Image URL copied to clipboard");
                                    }}
                                    className="h-8 w-8 rounded-md text-neutral-600 dark:text-neutral-400"
                                    title="Copy link"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                
                                <a 
                                    href={imageAttachments[selectedIndex].url} 
                                    download={imageAttachments[selectedIndex].name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                                    title="Download"
                                >
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                        <path d="M7.50005 1.04999C7.74858 1.04999 7.95005 1.25146 7.95005 1.49999V8.41359L10.1819 6.18179C10.3576 6.00605 10.6425 6.00605 10.8182 6.18179C10.994 6.35753 10.994 6.64245 10.8182 6.81819L7.81825 9.81819C7.64251 9.99392 7.35759 9.99392 7.18185 9.81819L4.18185 6.81819C4.00611 6.64245 4.00611 6.35753 4.18185 6.18179C4.35759 6.00605 4.64251 6.00605 4.81825 6.18179L7.05005 8.41359V1.49999C7.05005 1.25146 7.25152 1.04999 7.50005 1.04999ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5539 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1046 12.1059 14 11.0012 14H3.99635C2.89019 14 2 13.1046 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                    </svg>
                                </a>
                                
                                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-8">
                                    {selectedIndex + 1} of {imageAttachments.length}
                                </Badge>
                            </div>
                            
                            <div className="w-8"></div> {/* Spacer to balance the header and avoid overlap with close button */}
                        </header>
                        
                        <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
                            <div className="relative max-w-full max-h-[60vh]">
                                <img
                                    src={imageAttachments[selectedIndex].url}
                                    alt={imageAttachments[selectedIndex].name || `Image ${selectedIndex + 1}`}
                                    className="max-w-full max-h-[60vh] object-contain rounded-md"
                                />
                                
                                {imageAttachments.length > 1 && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedIndex(prev => (prev === 0 ? imageAttachments.length - 1 : prev - 1))}
                                            className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 shadow-sm"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedIndex(prev => (prev === imageAttachments.length - 1 ? 0 : prev + 1))}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 shadow-sm"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {imageAttachments.length > 1 && (
                            <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
                                <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                                    {imageAttachments.map((attachment, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedIndex(idx)}
                                            className={`relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 transition-all ${
                                                selectedIndex === idx 
                                                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
                                                    : 'opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <img 
                                                src={attachment.url} 
                                                alt={attachment.name || `Thumbnail ${idx + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <footer className="border-t border-neutral-200 dark:border-neutral-800 p-3">
                            <div className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                                <span className="truncate max-w-[80%]">
                                    {imageAttachments[selectedIndex].name || `Image ${selectedIndex + 1}`}
                                </span>
                                {imageAttachments[selectedIndex].size && (
                                    <span>
                                        {Math.round(imageAttachments[selectedIndex].size / 1024)} KB
                                    </span>
                                )}
                            </div>
                        </footer>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

const Home = () => {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <HomeContent />
            <InstallPrompt />
        </Suspense>
    );
};

export default Home;