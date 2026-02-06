"use client";

import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  FORMAT_TEXT_COMMAND,
  type RangeSelection,
} from "lexical";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Pilcrow,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadImageToCloudinary } from "@/actions/cloudinary";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { $createImageNode } from "./image-node";

type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "number";

export default function RichTextToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [isUploading, startUploadTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<RangeSelection | null>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));

      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType<ListNode>(
            anchorNode,
            ListNode,
          );
          const type = parentList
            ? parentList.getListType()
            : element.getListType();
          setBlockType(type === "bullet" ? "bullet" : "number");
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : $isQuoteNode(element)
              ? "quote"
              : "paragraph";
          setBlockType(type as BlockType);
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatHeading = (headingType: HeadingTagType) => {
    if (blockType !== headingType) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingType));
        }
      });
    } else {
      formatParagraph();
    }
  };

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  const formatQuote = () => {
    if (blockType !== "quote") {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    } else {
      formatParagraph();
    }
  };

  const formatBulletList = () => {
    if (blockType !== "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const handleImageUpload = () => {
    // Save current selection before opening file dialog
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        savedSelectionRef.current = selection.clone();
      }
    });
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPG, PNG, or WebP files.");
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Please upload files smaller than 5MB.");
      return;
    }

    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "product-descriptions");

        const result = await uploadImageToCloudinary(formData);

        if (result.success) {
          editor.update(() => {
            const imageNode = $createImageNode({
              src: result.url,
              altText: file.name,
            });

            // Restore selection or insert at end
            if (savedSelectionRef.current) {
              $setSelection(savedSelectionRef.current);
              $insertNodes([imageNode]);
            } else {
              // Insert at end of document
              const root = $getRoot();
              root.append(imageNode);
            }

            savedSelectionRef.current = null;
          });
          toast.success("Image uploaded successfully!");
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload image. Please try again.");
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Block Type */}
      <Button
        type="button"
        variant={blockType === "paragraph" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={formatParagraph}
        title="Paragraph"
      >
        <Pilcrow className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={blockType === "h1" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => formatHeading("h1")}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={blockType === "h2" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => formatHeading("h2")}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={blockType === "h3" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => formatHeading("h3")}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text Format */}
      <Button
        type="button"
        variant={isBold ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isItalic ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isUnderline ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isStrikethrough ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists and Quote */}
      <Button
        type="button"
        variant={blockType === "bullet" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={formatBulletList}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={blockType === "number" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={formatNumberedList}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={blockType === "quote" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={formatQuote}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Image Upload */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleImageUpload}
        disabled={isUploading}
        title="Upload Image"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
