require("dotenv").config();

const { Client } = require("@notionhq/client");
const moment = require("moment");

const client = new Client({ auth: process.env.NOTION_KEY });

const notion = {
  async getPage(id) {
    return await client.pages.retrieve({ page_id: id });
  },
  getPropsOf(page) {
    const desc = page.properties.description.rich_text;
    return {
      slug: page.properties.slug.formula.string,
      cover: page.cover ? page.cover[page.cover.type].url : null,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
      oriCategory: page.properties.category.select.name,
      category: page.properties.category.select.name.toLowerCase(),
      title: page.properties.title.title[0].plain_text,
      tags: page.properties.tags.multi_select.map((v) => v.name),
      description: desc.length > 0 ? desc[0].plain_text : "",
    };
  },
  async getAllPages(id, start_cursor) {
    let result = [];
    const options = {
      database_id: id,
      start_cursor,
      // Publish 된 것만 가져온다.
      filter: {
        and: [
          {
            property: "published",
            checkbox: {
              equals: true,
            },
          },
        ],
      },

      // 생성일 기준 내림차순정렬
      sorts: [
        {
          timestamp: "created_time",
          direction: "descending",
        },
      ],
    };

    const response = await client.databases.query(options);
    result = result.concat(response.results);

    if (response.has_more) {
      const sub = await this.getAllPages(id, response.next_cursor);
      result = result.concat(sub);
    }

    return result;
  },
  async getBlocksOf(pageId) {
    const blocks = [];

    const res = await client.blocks.children.list({ block_id: pageId });
    for (const block of res.results) {
      block.children = [];
      if (block.has_children) {
        block.children = await this.getBlocksOf(block.id);
      }

      blocks.push(block);
    }
    return blocks;
  },

  async getAllMusics(id) {
    const response = await client.databases.query({ database_id: id });
    const props = [];
    for (const m of response.results) {
      props.push({
        title: m.properties.title.title[0].plain_text,
        artist: m.properties.artist.rich_text[0].plain_text,
        src: m.properties.src.files[0].file.url,
        image: m.properties.image.files[0].file.url,
      });
    }
    return props;
  },

  async getAllDiary(id) {
    const response = await client.databases.query({ database_id: id });
    const props = [];
    for (const m of response.results) {
      const image = m.properties.image.files;
      const year = moment(m.properties.created.created_time).year();

      if (props.length == 0 || props[props.length - 1].year != year) {
        props.push({
          year,
          events: [],
        });
      }

      props[props.length - 1].events.push({
        title: m.properties.title.title[0].plain_text,
        content: m.properties.content.rich_text[0].plain_text,
        image: image.length > 0 ? image[0].file.url : "",
        created: m.properties.created.created_time,
      });
    }
    return props;
  },
};

exports.notion = notion;
