const ogs = require("open-graph-scraper");
const hljs = require("highlight.js/lib/common");
const { default: axios } = require("axios");
const { notion } = require("./notion");

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/gi, "-")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-$/g, "");

const htmlParser = {
  parseText(text, annotations, href) {
    let result = text.replace(/</gi, "&lt;").replace(/>/gi, "&gt;");

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
      result = `<a href="${href}" target="_blank" class="text-link">${result}</a>`;
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

    return `<pre class="code-block"><div class="head"><p class="language ${language}">${language}</p>${captionHTML}</div><code class="code-block__content hljs language-${codeObj.language}">${codeObj.value}</code>
            </pre>`;
  },
  parseTexts(obj, children = "", noTag = false) {
    let result = "";
    for (const text of obj[obj.type].rich_text) {
      result += this.parseText(text.plain_text, text.annotations, text.href);
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
        break;
    }

    let openTag = `<${tag}`;
    if (className) {
      openTag += ` class="${className}"`;
    }
    openTag += ">";
    const closeTag = `</${tag}>`;

    if (noTag) {
      return result;
    } else {
      return `${openTag}${result}${children}${closeTag}`;
    }
  },
  async parse(content, depth = 0) {
    let html = "";
    let prevType = null;

    let toc = "";
    if (depth === 0) {
      toc = `<div class="toc">`;
    }

    let isTocFirst = true;

    for (let idx = 0; idx < content.length; idx++) {
      const c = content[idx];
      const childrenHTML = await this.parse(c.children, depth + 1);

      // li -> p : list 끝  </ul> </ol> 추가
      if (prevType != c.type) {
        if (prevType == "bulleted_list_item") {
          html += "</ul>";
        } else if (prevType == "numbered_list_item") {
          html += "</ol>";
        }
      }

      switch (c.type) {
        case "heading_2":
          const headerText = this.parseTexts(c, "", true);
          const headerSlug = slugify(headerText);
          if (depth == 0) {
            if (isTocFirst) {
              toc += `<div class='toc-block'>`;
              isTocFirst = false;
            } else {
              toc += `</div><div class='toc-block'>`;
            }

            toc += `<a class='h2' href='#${headerSlug}'>${headerText}</a>`;
          }

          html += `<h2 id="${headerSlug}">${headerText}</h2>`;
          break;
        case "heading_3":
          const header3Text = this.parseTexts(c, "", true);
          const header3Slug = slugify(header3Text);

          if (depth == 0) {
            toc += `<a class='h3' href='#${header3Slug}'>${header3Text}</a>`;
          }
          html += `<h3 id="${header3Slug}">${header3Text}</h3>`;
          break;
        case "paragraph":
        case "quote":
        case "to_do":
        case "bulleted_list_item":
        case "numbered_list_item":
        case "todo":
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
          try {
            const videoId = re.exec(c.video.external.url)[1];

            html += `<div preload="none" class="video"><div class="video-container"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
          } catch {
            `<video class="video"><source src="${c.video.file.url}" type="video/mov" /></video>`;
          }
          break;
        case "audio":
          html += `<audio controls preload="none" src=${c.audio.file.url}></audio>`;
          break;
        case "callout":
          const emoji = c.callout.icon.emoji;

          let type = "";
          if (emoji === "⚠️") {
            type = "warn";
          } else if (emoji === "ℹ️") {
            type = "info";
          }

          html += `<div class='callout ${type}'>`;
          html += `<div class='callout__emoji'>${emoji}</div>`;
          html += `<div class='callout__content'>${this.parseTexts(
            c,
            childrenHTML
          )}</div>`;
          html += "</div>";
          break;
        case "embed": // codepen
          const u = c.embed.url.split("/");
          const hash = u[u.length - 1];

          html += `<iframe height="500" style="width: 100%;" scrolling="no" title="Untitled" src="https://codepen.io/bwealthy72/embed/${hash}?default-tab=js%2Cresult&editable=true" frameborder="no" loading="lazy" allowtransparency="true" allowfullscreen="true"> </iframe>`;
          break;
        case "file":
          const url = c.file.file.url;
          const lastUrl = url.split("/");
          const fileName = lastUrl[lastUrl.length - 1].split("?")[0];

          html += `<a href="${url}" class="file">${fileName}</a>`;
          break;
        case "bookmark":
          try {
            const data = await ogs({
              url: c.bookmark.url,
              timeout: 5000,
              downloadLimit: 3000000,
            });
            const r = data?.result;
            if (r?.success) {
              let favicon = "";
              if (r.favicon.startsWith("http")) {
                favicon = r.favicon;
              } else {
                const re = /^https?:\/\/[^#?\/]+/gi;
                const baseUrl = re.exec(r.requestUrl)[0];
                favicon = baseUrl + r.favicon;
              }

              const right =
                r.ogImage && r.ogImage.url
                  ? `<div class="bookmark__right"><img src="${r.ogImage.url}" /></div>`
                  : "";

              const descHTML = r.ogDescription
                ? `<p class="desc">${r.ogDescription}</p>`
                : "";
              const urlHTML = r.ogUrl ? `<p class="link">${r.ogUrl}</p>` : "";

              html += `<a href="${r.ogUrl}" class="bookmark" target="_blank">
                  <div class="bookmark__left">
                    <h4 class="title">${r.ogTitle}</h4>
                    ${descHTML}
                    ${urlHTML}
                  </div>
                  ${right}
                </a>
              `;
            }
          } catch (e) {
            console.error(e);
          }
          break;
        case "link_to_page":
          const page = await notion.getPage(c.link_to_page.page_id);
          const props = notion.getPropsOf(page);
          const _url = `/post/${props.category}/${props.slug}`;
          const img = props.cover
            ? `<div class="bookmark__right"><img src="${props.cover}" /></div>`
            : "";

          html += `
            <a href="${_url}" class="bookmark" target="_blank">
              <div class="bookmark__left">
                <h4 class="title">${props.title}</h4>
                <p class="desc">${props.description}</p>
                <p><img src="/favicon.ico" class="favicon" /><span class="link">${_url}</span></p>
              </div>
              ${img}
            </a>
          `;

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
    }

    if (depth === 0) {
      toc += "</div></div>";
      return toc + html;
    } else {
      return html;
    }
  },
};

exports.htmlParser = htmlParser;
