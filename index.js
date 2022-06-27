const { mongo } = require("./src/mongodb");
const { notion } = require("./src/notion");
const { htmlParser } = require("./src/htmlParser");
const moment = require("moment");
require("moment-timezone");
moment.tz.setDefault("Asia/Seoul");
const app = require("express")();

const updateMongoDB = async function () {
  const pages = await notion.getAllPages(process.env.NOTION_POST_DB_ID);

  const result = [];
  const categories = {};
  for (const page of pages) {
    const blocks = await notion.getBlocksOf(page.id);
    const props = notion.getPropsOf(page);

    categories[props.category] = categories.hasOwnProperty(props.category)
      ? categories[props.category] + 1
      : 1;

    result.push({
      ...props,
      body: htmlParser.parse(blocks),
    });
    console.log(page.id);
  }

  // Post
  await mongo.insertMany("notion", "posts", result);

  const cateResult = [];
  for (const category in categories) {
    cateResult.push({ category, count: categories[category] });
  }
  await mongo.insertMany("notion", "categories", cateResult);

  // Musics
  const musics = await notion.getAllMusics(process.env.NOTION_MUSIC_DB_ID);
  await mongo.insertMany("notion", "musics", musics);

  console.log("Updated", moment(new Date()).format());
};

updateMongoDB();
setInterval(() => {
  try {
    updateMongoDB();
  } catch (err) {
    console.error(err);
  }
}, 50 * 60 * 1000);

app.listen(8000);
