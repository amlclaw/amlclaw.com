"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { renderMarkdown } from "@/lib/utils";

interface Props {
  content: string;
}

// Usable content height per page (page min-height 1056px - padding 72+80=152px)
const PAGE_HEIGHT = 904;

/**
 * Renders markdown as paginated A4 pages.
 *
 * Strategy: render all content in a single invisible container,
 * measure each top-level block's cumulative height,
 * then split into pages.
 */
export default function DocumentPaper({ content }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[] | null>(null);

  const html = renderMarkdown(content);

  const paginate = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;

    const blocks = Array.from(el.children) as HTMLElement[];
    if (blocks.length === 0) {
      setPages([html]);
      return;
    }

    const result: string[] = [];
    let batch: string[] = [];
    let usedHeight = 0;

    for (const block of blocks) {
      // offsetTop is relative to the offsetParent (the measure container)
      // Use offsetHeight which doesn't require visibility tricks
      const h = block.offsetHeight;

      if (usedHeight > 0 && usedHeight + h > PAGE_HEIGHT) {
        // Flush current batch as a page
        result.push(batch.join(""));
        batch = [];
        usedHeight = 0;
      }

      batch.push(block.outerHTML);
      usedHeight += h;
    }

    if (batch.length > 0) {
      result.push(batch.join(""));
    }

    setPages(result.length > 0 ? result : [html]);
  }, [html]);

  useEffect(() => {
    // Double rAF to ensure layout is complete
    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(paginate);
      });
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(run);
    } else {
      run();
    }
  }, [paginate]);

  return (
    <div className="document-paper-scroll">
      {/* Measuring container — rendered off-screen but in-flow for offsetHeight to work */}
      <div
        ref={measureRef}
        className="markdown-body"
        style={{
          position: "fixed",
          top: -99999,
          left: 0,
          width: 672, // 816 - 72*2 padding
          visibility: "hidden",
          pointerEvents: "none",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="document-paper">
        {pages ? (
          pages.map((pageHtml, i) => (
            <div
              key={i}
              className="document-page"
              data-page={`${i + 1} / ${pages.length}`}
            >
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: pageHtml }}
              />
            </div>
          ))
        ) : (
          /* Initial: single page while measuring */
          <div className="document-page">
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
