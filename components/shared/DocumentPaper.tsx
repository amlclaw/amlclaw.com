"use client";

import { useRef, useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/utils";

interface Props {
  content: string;
}

// A4 page height in px at 96dpi: 11.69in * 96 = ~1122px
// Minus padding (72px top + 80px bottom = 152px) = ~970px usable
const PAGE_CONTENT_HEIGHT = 970;

/**
 * Renders markdown content as paginated A4 pages.
 * Measures rendered HTML height and splits into pages at block boundaries.
 */
export default function DocumentPaper({ content }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const html = renderMarkdown(content);

  useEffect(() => {
    if (!measureRef.current) return;

    // Wait for fonts to load before measuring
    const measure = () => {
      const container = measureRef.current;
      if (!container) return;

      const children = Array.from(container.children) as HTMLElement[];
      if (children.length === 0) {
        setPages([html]);
        setReady(true);
        return;
      }

      const pageBreaks: number[] = [0]; // indices where new pages start
      let currentHeight = 0;

      for (let i = 0; i < children.length; i++) {
        const el = children[i];
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const elHeight = rect.height + marginTop + marginBottom;

        // Would this element overflow the current page?
        if (currentHeight + elHeight > PAGE_CONTENT_HEIGHT && currentHeight > 0) {
          pageBreaks.push(i);
          currentHeight = elHeight;
        } else {
          currentHeight += elHeight;
        }
      }

      // Build page HTML
      const pageHtmls: string[] = [];
      for (let p = 0; p < pageBreaks.length; p++) {
        const start = pageBreaks[p];
        const end = p < pageBreaks.length - 1 ? pageBreaks[p + 1] : children.length;
        let pageContent = "";
        for (let i = start; i < end; i++) {
          pageContent += children[i].outerHTML;
        }
        pageHtmls.push(pageContent);
      }

      setPages(pageHtmls.length > 0 ? pageHtmls : [html]);
      setReady(true);
    };

    // Measure after render + fonts
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => requestAnimationFrame(measure));
    } else {
      requestAnimationFrame(measure);
    }
  }, [html]);

  return (
    <div className="document-paper-scroll">
      {/* Hidden measuring container */}
      <div
        ref={measureRef}
        className="markdown-body"
        style={{
          position: "absolute",
          visibility: "hidden",
          width: 672, // 816px - 72px*2 padding
          padding: 0,
          left: -9999,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Rendered pages */}
      <div className="document-paper">
        {ready ? (
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
          /* Show single page while measuring */
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
