function inlineFormat(text) {
  const parts = [];
  const re =
    /(~~[^~]+~~|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>"')]+|@[\w-]+)/g;
  let last = 0,
    m,
    k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    const raw = m[0];

    if (raw.startsWith("~~")) {
      parts.push(
        <s key={k++} style={{ color: "var(--text3)" }}>
          {raw.slice(2, -2)}
        </s>,
      );
    } else if (raw.startsWith("**")) {
      parts.push(
        <strong key={k++} style={{ color: "var(--text)", fontWeight: 600 }}>
          {raw.slice(2, -2)}
        </strong>,
      );
    } else if (raw.startsWith("*") || raw.startsWith("_")) {
      parts.push(
        <em key={k++} style={{ color: "var(--text2)", fontStyle: "italic" }}>
          {raw.slice(1, -1)}
        </em>,
      );
    } else if (raw.startsWith("`")) {
      parts.push(
        <code
          key={k++}
          style={{
            fontSize: 11,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "monospace",
            color: "var(--text)",
          }}
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("![")) {
      const mm = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (mm) {
        parts.push(
          <img
            key={k++}
            src={mm[2]}
            alt={mm[1]}
            style={{
              maxWidth: "100%",
              verticalAlign: "middle",
              borderRadius: 6,
              border: "1px solid var(--border)",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />,
        );
      }
    } else if (raw.startsWith("[")) {
      const mm = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        parts.push(
          <a
            key={k++}
            href={mm[2]}
            onClick={(e) => {
              e.preventDefault();
              window.electron?.openExternal(mm[2]);
            }}
            style={{
              color: "var(--red)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {mm[1]}
          </a>,
        );
      }
    } else if (raw.startsWith("@")) {
      const username = raw.slice(1);
      parts.push(
        <a
          key={k++}
          href={`https://github.com/${username}`}
          onClick={(e) => {
            e.preventDefault();
            window.electron?.openExternal(`https://github.com/${username}`);
          }}
          style={{
            color: "var(--red)",
            textDecoration: "none",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {raw}
        </a>,
      );
    } else if (raw.startsWith("http")) {
      // Shorten PR/issue URLs to "#41"
      let label = raw;
      try {
        const u = new URL(raw);
        const prMatch = u.pathname.match(/\/(pull|issues?)\/(\d+)$/);
        if (prMatch) label = `#${prMatch[2]}`;
        else label = u.hostname.replace(/^www\./, "") + u.pathname;
      } catch {}
      parts.push(
        <a
          key={k++}
          href={raw}
          onClick={(e) => {
            e.preventDefault();
            window.electron?.openExternal(raw);
          }}
          style={{
            color: "var(--red)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "0.95em",
          }}
        >
          {label}
        </a>,
      );
    }

    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

function renderChangelog(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // h3 ###
    if (line.startsWith("### ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text)",
            marginTop: 14,
            marginBottom: 4,
            letterSpacing: 0.3,
          }}
        >
          {inlineFormat(line.slice(4))}
        </div>,
      );
      continue;
    }

    // h2 ##
    if (line.startsWith("## ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text)",
            marginTop: 16,
            marginBottom: 6,
            borderBottom: "1px solid var(--border)",
            paddingBottom: 4,
          }}
        >
          {inlineFormat(line.slice(3))}
        </div>,
      );
      continue;
    }

    // h1 #
    if (line.startsWith("# ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text)",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          {inlineFormat(line.slice(2))}
        </div>,
      );
      continue;
    }

    // horizontal rule --- / *** / ___  (must come before bullet check)
    if (/^([-*_])\1{2,}\s*$/.test(line.trim())) {
      elements.push(
        <div
          key={key++}
          style={{
            borderBottom: "1px solid var(--border)",
            margin: "12px 0",
          }}
        />,
      );
      continue;
    }

    // blockquote > …
    if (line.startsWith("> ")) {
      elements.push(
        <div
          key={key++}
          style={{
            borderLeft: "3px solid var(--red)",
            paddingLeft: 10,
            margin: "4px 0",
            color: "var(--text3)",
            fontSize: 13,
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {inlineFormat(line.slice(2))}
        </div>,
      );
      continue;
    }

    // HTML img tag: <img ... src="..." ... alt="..." ...>
    const htmlImgMatch = line.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/i);
    if (htmlImgMatch) {
      const src = htmlImgMatch[1];
      const altMatch = line.match(/\balt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : "";
      elements.push(
        <div key={key++} style={{ margin: "10px 0" }}>
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid var(--border)",
              display: "block",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {alt && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text3)",
                textAlign: "center",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {alt}
            </div>
          )}
        </div>,
      );
      continue;
    }

    // standalone markdown image ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      elements.push(
        <div key={key++} style={{ margin: "10px 0" }}>
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid var(--border)",
              display: "block",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {alt && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text3)",
                textAlign: "center",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {alt}
            </div>
          )}
        </div>,
      );
      continue;
    }

    // numbered list  1. …
    const numMatch = line.match(/^(\d+)\. (.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={key++}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              color: "var(--red)",
              flexShrink: 0,
              fontWeight: 600,
              minWidth: 18,
              textAlign: "right",
            }}
          >
            {numMatch[1]}.
          </span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // unordered bullet - or *
    if (/^[-*] /.test(line)) {
      elements.push(
        <div
          key={key++}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.6,
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }}>
            •
          </span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>,
      );
      continue;
    }

    // blank line
    if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }

    // normal paragraph
    elements.push(
      <div
        key={key++}
        style={{
          fontSize: 13,
          color: "var(--text2)",
          lineHeight: 1.6,
          marginBottom: 2,
        }}
      >
        {inlineFormat(line)}
      </div>,
    );
  }
  return elements;
}

export { inlineFormat, renderChangelog };
