const hljs = require("highlight.js/lib/common");

const htmlParser = {
  parseText(text, annotations, href) {
    let result = text;
    if (annotations.bold) {
      result = `<strong>${result}</strong>`;
    }
    if (annotations.italic) {
      result = `<em>${result}</em>`;
    }
    if (annotations.strikethrough) {
      result = `<del>${result}</del>`;
    }
    if (annotations.underline) {
      result = `<u>${result}</u>`;
    }
    if (annotations.code) {
      result = `<code class="code">${result}</code>`;
    }
    if (href) {
      result = `<a href="${href}">${result}</a>`;
    }
    return result;
  },
  parseCode(obj) {
    const str = obj[obj.type].rich_text[0].plain_text;
    const language = obj.code.language;

    const codeObj = hljs.highlight(str, { language });

    const captionHTML = this.parseTexts({
      type: "caption",
      caption: {
        rich_text: obj.code.caption,
      },
    });

    return `<pre class="code-block"><div class="code-block__language ${language}">${language}</div>${captionHTML}<code class="code-block__content hljs language-${codeObj.language}">${codeObj.value}</code>
            </pre>`;
  },
  parseTexts(obj, children = "") {
    let result = "";
    for (const text of obj[obj.type].rich_text) {
      const t = text.plain_text.replace("\n", "<br />");
      result += this.parseText(t, text.annotations, text.href);
    }
    let tag = "";
    let className = "";
    switch (obj.type) {
      case "heading_1":
        tag = "h1";
        break;
      case "heading_2":
        tag = "h2";
        break;
      case "heading_3":
        tag = "h3";
        break;
      case "quote":
        tag = "blockquote";
        break;
      case "paragraph":
        tag = "p";
        break;
      case "to_do":
        tag = "div";
        className = "to-do";
        if (obj.to_do.checked) {
          className += " checked";
        }
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
        tag = "li";
        break;
      case "callout":
        tag = "div";
        className = "callout__content";
      case "caption":
        tag = "p";
        className = "caption";
    }

    let openTag = `<${tag}`;
    if (className) {
      openTag += ` class=${className}`;
    }
    openTag += ">";
    const closeTag = `</${tag}>`;

    return `${openTag}${result}${children}${closeTag}`;
  },
  parse(content) {
    let html = "";
    let prevType = null;

    content.forEach((c, idx) => {
      const childrenHTML = this.parse(c.children);

      // li -> p : list 끝  </ul> </ol> 추가
      if (prevType != c.type) {
        if (prevType == "bulleted_list_item") {
          html += "</ul>";
        } else if (prevType == "numbered_list_item") {
          html += "</ol>";
        }
      }

      switch (c.type) {
        case "heading_1":
        case "heading_2":
        case "heading_3":
        case "paragraph":
        case "quote":
        case "to_do":
        case "bulleted_list_item":
        case "numbered_list_item":
          if (prevType != c.type) {
            if (c.type === "numbered_list_item") {
              html += "<ol>";
            } else if (c.type === "bulleted_list_item") {
              html += "<ul>";
            }
          }

          html += this.parseTexts(c, childrenHTML);
          break;
        case "code":
          html += this.parseCode(c);
          break;
        case "divider":
          html += "<hr />";
          break;
        case "image":
          html += `<img src='${c.image.file.url}' />`;
          break;
        case "video":
          const re = /.*v=(.*)/gi;
          const videoId = re.exec(c.video.external.url)[1];

          html += `<div preload="none" class="video"><div class="video-container"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
          break;
        case "audio":
          html += `<audio controls preload="none" src=${c.audio.file.url}></audio>`;
          break;
        case "callout":
          html += "<div class='callout'>";
          html += `<div class='callout__emoji'>${c.callout.icon.emoji}</div>`;
          html += `<div class='callout__content'>${this.parseTexts(
            c,
            childrenHTML
          )}</div>`;
          html += "</div>";
          break;
      }

      if (idx == content.length - 1) {
        if (c.type == "bulleted_list_item") {
          html += "</ul>";
        } else if (c.type == "numbered_list_item") {
          html += "</ol>";
        }
      }

      prevType = c.type;
    });

    return html;
  },
};

exports.htmlParser = htmlParser;
