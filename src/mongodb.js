require("dotenv").config();
const { MongoClient } = require("mongodb");

const mongo = {
  client: null,
  db: null,
  collection: null,

  async connectDB(db, collection) {
    this.client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await this.client.connect();
    this.db = this.client.db(db);
    this.collection = this.db.collection(collection);
  },
  async insertMany(db, collection, items) {
    await this.connectDB(db, collection);

    mongo.collection.deleteMany();
    mongo.collection.insertMany(items);

    this.close();
  },
  close() {
    this.client.disconnect();
  },
};

exports.mongo = mongo;
