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

    await mongo.collection.deleteMany();
    await mongo.collection.insertMany(items);

    await this.client.close();
  },
};

exports.mongo = mongo;
