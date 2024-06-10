const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.DB_STRIPE);

const app = express();
const port = process.env.PORT || 5000;

// midleware
app.use(
  cors({
    origin: ["http://localhost:5173","https://pattee-29048.web.app/"],
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
    const campaignCollection = client.db("patte").collection("campaign");
    const donationCollection = client.db("patte").collection("donation");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.DB_SECRET);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Veryfy admin
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);

      if (!result || result?.role !== "admin")
        


        return res.status(401).send({ message: "unauthorized access!!" });

      next();
    };

    app.get("/category/:cetegory", async (req, res) => {
      const category = req.params.cetegory;
      const query = {
        $and: [{ category: category }, { adopted: false }],
      };

      const result = await petCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

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

    // ----------------------local api---------------

    app.get("/all-donation-campaigns", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const petsPerPage = 3;
      const totalPets = await campaignCollection.countDocuments();
      const totalPages = Math.ceil(totalPets / petsPerPage);
      const result = await campaignCollection
        .find()
        .sort({ date: -1 })
        .skip((page - 1) * petsPerPage)
        .limit(petsPerPage)
        .toArray();

      res.send({
        result,
        hasNext: page < totalPages,
        nextPage: page < totalPages ? page + 1 : null,
      });
    });

    app.get("/campaigns-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campaignCollection.findOne(query);
      res.send(result);
    });

    app.get("/petDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const price = req.body.price;

      const priceInCent = parseFloat(price) * 100;

      if (!price || priceInCent < 1)
        return res.status(400).send({ error: "Invalid price" });

      try {
        const { client_secret } = await stripe.paymentIntents.create({
          amount: priceInCent,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });

        res.send({ clientSecret: client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // ---------------------create user api-----------------

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // -------------------admin check api------------

    app.get("/check-admin/:email",  async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // ----------------------admin special api----------------

    app.get("/all-users", verifyToken, verifyAdmin,async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch(
      "/make-Admin/:email",
      verifyAdmin,
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const options = { upsert: true };
        const data = req.body;
        const updateDoc = {
          $set: {
            ...data,
          },
        };
        const result = await userCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    app.get("/all-pets", verifyToken, verifyAdmin ,async (req, res) => {
      const result = await petCollection.find().toArray();
      res.send(result);
    });

    app.get("/all-donation", verifyToken, verifyAdmin,async (req, res) => {
      const result = await campaignCollection.find().toArray();
      res.send(result);
    });

    // --------------pets api------------------

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

      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await petCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.patch("/my-pets-req-handle/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await adoptionCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.get("/my-total-pet/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const count = await petCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/my-pet-adoptetion/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { donetor_email: email };
      const count = await adoptionCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/my-pets-req/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { donetor_email: email };
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await adoptionCollection
        .find(query)
        .skip((page - 1) * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/my-pets/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(401).json({ message: "Unauthorized access" });
        }

        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);

        const query = { email: email };

        const result = await petCollection
          .find(query)
          .skip((page - 1) * size)
          .limit(size)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.delete("/my-pets-delete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.deleteOne(query);
      res.send(result);
    });

    // ---------------------donation api-----------------------

    app.post("/donation", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await donationCollection.insertOne(data);
      res.send(result);
    });
    app.get("/donation-info/:pet_id", verifyToken, async (req, res) => {
      const pet_id = req.params.pet_id;
      const query = { pet_id: pet_id };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/My-donation-campaigns/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await campaignCollection
        .find(query)
        .skip((page - 1) * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/My-campaigns-count/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const count = await campaignCollection.countDocuments(query);
      res.send({ count });
    });

    app.patch("/update-cam/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        const query = { _id: new ObjectId(id) };
        const options = { upsert: true };

        const updateDoc = {
          $set: {
            ...data,
          },
        };

        const result = await campaignCollection.updateOne(
          query,
          updateDoc,
          options
        );

        res.send(result);
      } catch (error) {
        console.error("Error updating campaign:", error);
        res
          .status(500)
          .send({ error: "An error occurred while updating the campaign" });
      }
    });

    app.post("/campaign", async (req, res) => {
      const data = req.body;
      const result = await campaignCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/delete-campaign/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campaignCollection.deleteOne(query);
      res.send(result);
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
