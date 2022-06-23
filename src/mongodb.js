require("dotenv").config();
const { MongoClient } = require("mongodb");

const mongo = {
  client: null,
  db: null,
  collection: null,

  async connectDB() {
    this.client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB);
    this.collection = this.db.collection(process.env.MONGODB_COLLECTION);
  },
};

exports.mongo = mongo;
