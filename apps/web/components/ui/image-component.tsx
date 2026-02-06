"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { GripVertical, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { $isImageNode, type ImageNode } from "./image-node";

interface ImageComponentProps {
  src: string;
  altText: string;
  width?: number;
  height?: number;
  nodeKey: NodeKey;
}

export default function ImageComponent({
  src,
  altText,
  width: initialWidth,
  height: initialHeight,
  nodeKey,
}: ImageComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setIsSelected] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(initialWidth || 400);
  const imageRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(100, startWidthRef.current + deltaX);
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Update the node with new dimensions
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node && $isImageNode(node)) {
            const writableNode = node.getWritable() as ImageNode;
            writableNode.__width = width;
          }
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editor, nodeKey, width],
  );

  return (
    <div
      className={`relative inline-block my-2 group ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onClick={() => setIsSelected(true)}
      onBlur={() => setIsSelected(false)}
    >
      <Image
        ref={imageRef}
        src={src}
        height={initialHeight || 300}
        alt={altText}
        width={width}
        className="max-w-full h-auto rounded-md block"
        draggable={false}
      />

      {/* Delete button - visible on hover or when selected */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90 focus:opacity-100"
        title="Delete image"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Resize handle - visible on hover or when selected */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute bottom-2 right-2 p-1 rounded bg-background border shadow-sm cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? "opacity-100" : ""}`}
        title="Drag to resize"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Width indicator while resizing */}
      {isResizing && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background border shadow-sm text-xs text-muted-foreground">
          {Math.round(width)}px
        </div>
      )}
    </div>
  );
}
