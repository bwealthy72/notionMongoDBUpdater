const { mongo } = require("./src/mongodb");
const { notion } = require("./src/notion");
const { htmlParser } = require("./src/htmlParser");
const app = require("express")();

const updateMongoDB = async function () {
  const pages = await notion.getAllPages();

  await mongo.connectDB();

  const result = [];
  for (const page of pages) {
    const blocks = await notion.getBlocksOf(page.id);
    result.push({
      ...notion.getPropsOf(page),
      body: htmlParser.parse(blocks),
    });
    console.log(page.id);
  }

  mongo.collection.deleteMany();
  mongo.collection.insertMany(result);

  console.log("Updated", new Date());
};

updateMongoDB();
setInterval(() => {
  updateMongoDB();
}, 8 * 60 * 60 * 1000);

app.listen(8000);
