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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3liiwir.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const adoptionCollection = client.db("patte").collection("adopted");

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

 

    app.get('/category/:cetegory',async(req,res)=>{
      const category = req.params.cetegory;
      const query = {
        $and: [
          { category: category },
          { adopted: false }
        ]
      };
      console.log(query);
      const result = await petCollection.find(query).sort({ date: -1 }).toArray()
      res.send(result)
      console.log(result);
    })




    app.get("/pet", async (req, res) => {
      const search = req.query.search;
      const category = req.query.category; 
      const page = parseInt(req.query.page) || 1;
    
      const query = { adopted: false };
    
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (category) {
        query.category = category;
      }
  
    
      const petsPerPage = 3;
      const totalPets = await petCollection.countDocuments(query);
      const totalPages = Math.ceil(totalPets / petsPerPage);
    
      const pets = await petCollection
        .find(query)
        .sort({ date: -1 }) 
        .skip((page - 1) * petsPerPage)
        .limit(petsPerPage)
        .toArray();
    
      res.send({
        pets,
        hasNext: page < totalPages,
        nextPage: page < totalPages ? page + 1 : null,
      });
      
    });
    
    

    app.get("/petDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(query);
      res.send(result);
    });

    app.post("/add-pet", async (req, res) => {
      const data = req.body;
      const result = await petCollection.insertOne(data);
      res.send(result);
    });

    app.post("/adopted", async (req, res) => {
      const data = req.body;
      const result = await adoptionCollection.insertOne(data);
      res.send(result);
    });

    app.patch("/pet-adopt/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      console.log(data);
      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await petCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/my-pets/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });
    app.delete('/my-pets-delete/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)}
      const result = await petCollection.deleteOne(query);
      res.send(result)
    })







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
