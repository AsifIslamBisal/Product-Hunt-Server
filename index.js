const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.olaoh3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("product-hunt").collection("users");
    const productCollection = client.db("product-hunt").collection("products");
    const reviewsCollection = client.db("product-hunt").collection("reviews");

    // jwt api
    app.post('/jwt', async(req, res)=> {
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h' });
      res.send({token});
    });

    // middlewares
    const verifyToken = (req,res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err,decoded) =>{
        if (err) {
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async(req,res,next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }


    // users api

    app.get('/users', verifyToken,verifyAdmin, async (req,res) =>{
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/me', verifyToken, async (req, res) => {
  const email = req.decoded.email;  // টোকেন থেকে email পাওয়া যাবে
  const user = await userCollection.findOne({ email: email });
  if (!user) {
    return res.status(404).send({ message: 'User not found' });
  }
  res.send(user);
});



    app.get('/users/admin/:email',verifyToken, async(req,res) => {
      const email = req. params.email;
      if (email !== req.decoded.email) {
        return req.status(403).send ({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role ==='admin';
      }
      res.send({admin});
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({message: 'user alredy exists', insertedId: null})
      }
      const result = await userCollection. insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async(req,res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id',verifyToken,verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // all products
    app.get('/products', async(req, res) =>{
        const result = await productCollection.find().toArray();
        res.send(result);
    });

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id) }
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // উদাহরণ Express রাউট
    app.patch('/products/upvote/:id', async (req, res) => {
    const id = req.params.id;
    const result = await productCollection.updateOne(
    { _id: new ObjectId(id) },
    { $inc: { upvotes: 1 } }
  );
  res.send(result);
});



    // all reviews
    app.get('/reviews', async (req, res) => {
    const result = await reviewsCollection.find().toArray();
   res.send(result);
   });
    


    app.get('/reviews/:id', async (req, res) => {
      const id = req.params.id;
      const query = { productId: id }; // যদি productId দিয়ে review খুঁজিস
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });


   app.post('/reviews/:id', async (req, res) => {
  const productId = req.params.id;
  const reviewsDoc = req.body;

  // নিশ্চিত করো যে ডাটাতে productId আছে
  const reviewWithProductId = {
    ...reviewsDoc,
    productId: productId,
  };

  const result = await reviewsCollection.insertOne(reviewWithProductId);
  res.send(result);
});


   
    app.delete('/reviews/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await reviewsCollection.deleteOne(query);
  res.send(result);
});



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res) => {
    res.send ('product hunt is running')
})

app.listen(port, () => {
    console.log(`product is running on port ${port}`)
})