"use client";

import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import {
  type InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $insertNodes, type EditorState } from "lexical";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import "./rich-text-editor.css";
import { ImageNode } from "./image-node";
import RichTextToolbar from "./rich-text-toolbar";

const theme = {
  paragraph: "mb-2 last:mb-0",
  heading: {
    h1: "text-2xl font-bold mb-3",
    h2: "text-xl font-semibold mb-2",
    h3: "text-lg font-medium mb-2",
  },
  list: {
    ul: "list-disc ml-4 mb-2",
    ol: "list-decimal ml-4 mb-2",
    listitem: "mb-1",
  },
  quote:
    "border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground mb-2",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
  image: "editor-image",
};

function onError(error: Error) {
  console.error("Lexical Error:", error);
}

interface LoadInitialContentProps {
  initialContent?: string;
}

function LoadInitialContent({ initialContent }: LoadInitialContentProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (initialContent) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialContent, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        $insertNodes(nodes);
      });
    }
  }, [editor, initialContent]);

  return null;
}

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
}: RichTextEditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: "RichTextEditor",
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
      ImageNode,
    ],
  };

  const handleChange = useCallback(
    (
      editorState: EditorState,
      editor: ReturnType<typeof useLexicalComposerContext>[0],
    ) => {
      editor.read(() => {
        const html = $generateHtmlFromNodes(editor, null);
        onChange?.(html);
      });
    },
    [onChange],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "relative rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          className,
        )}
      >
        <RichTextToolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[150px] px-3 py-2 text-sm outline-none resize-none"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute top-2 left-3 text-muted-foreground text-sm">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin onChange={handleChange} />
        <LoadInitialContent initialContent={value} />
        {autoFocus && <AutoFocusPlugin />}
      </div>
    </LexicalComposer>
  );
}
