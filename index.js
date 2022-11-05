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

  let count = 0;
  const startTime = new Date();
  for (const page of pages) {
    const blocks = await notion.getBlocksOf(page.id);
    const props = notion.getPropsOf(page);

    if (categories.hasOwnProperty(props.category)) {
      categories[props.category].count += 1;
    } else {
      categories[props.category] = {
        oriCategory: props.oriCategory,
        count: 1,
      };
    }

    result.push({
      ...props,
      body: await htmlParser.parse(blocks),
    });

    const currTime = new Date();
    console.log(
      ++count,
      page.id,
      props.title,
      ((currTime - startTime) / 1000).toFixed(3) + "s"
    );
  }

  // Post
  console.log("post inserting...");
  await mongo.insertMany("notion", "posts", result);

  console.log("category inserting...");
  const cateResult = [
    { oriCategory: "전체", category: "", count: pages.length },
  ];

  for (const c in categories) {
    cateResult.push({
      oriCategory: categories[c].oriCategory,
      category: c,
      count: categories[c].count,
    });
  }
  await mongo.insertMany("notion", "categories", cateResult);

  // Musics
  console.log("music inserting...");
  const musics = await notion.getAllMusics(process.env.NOTION_MUSIC_DB_ID);
  await mongo.insertMany("notion", "musics", musics);

  // // Diary
  console.log("diary inserting...");
  const diary = await notion.getAllDiary(process.env.NOTION_DIARY_DB_ID);
  await mongo.insertMany("notion", "diary", diary);

  console.log("Updated", moment(new Date()).format("LLL"));
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
