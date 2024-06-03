const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// midleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.DB_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri =
  "mongodb+srv://12agt:RbbpYFL4xtaBjrgd@cluster0.3liiwir.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("patte").collection("users");
    const petCollection = client.db("patte").collection("pet");
    const adoptCollection = client.db("patte").collection("adopt");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      console.log(user);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return (
          res.send({ message: "user already exists", insertedId: null }),
          console.log("agin")
        );
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/pet", async (req, res) => {
      const search = req.query.search;
      const sort = req.query.sort;

      const query = { adopted:false };
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (sort) {
        query.category = { category: sort } ;
      }

      let option = {};

      // if (sort) {
      //   option = { sort: { category: sort } };
      // }
      const result = await petCollection.find(query,option).toArray();
      res.send(result);
    });







  
    app.post("/add-pet", async (req, res) => {
      const data = req.body;
      console.log('INSIDE DATA BASE ' ,data);
      const result = await petCollection.insertOne(data);
      res.send(result)
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
