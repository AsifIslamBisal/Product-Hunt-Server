const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const stripe = require('stripe') (process.env.STRIPE_SECRET__KEY);
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
    const paymentCollection = client.db("product-hunt").collection("payments");
    const upload = multer({ storage: multer.memoryStorage() });
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
  const email = req.decoded?.email;
  if (!email) {
    return res.status(401).send({ message: 'Unauthorized' });
  }

  const user = await userCollection.findOne({ email });
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

    app.patch('/users/subscribe/:email', async (req, res) => {
  const email = req.params.email;
  const result = await usersCollection.updateOne(
    { email },
    { $set: { isSubscribed: true } }
  );
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

    app.post('/products', upload.single('productImage'), async (req, res) => {
  try {
    const {
      productName,
      description,
      ownerName,
      ownerImage,
      ownerEmail,
      externalLink,
    } = req.body;
    const tags = req.body.tags; 

    const productImage = req.file; 
    const newProduct = {
      productName,
      description,
      ownerName,
      ownerImage,
      ownerEmail,
      externalLink,
      tags: Array.isArray(tags) ? tags : [tags],
      upvotes: 0,
      createdAt: new Date(),
      imageBuffer: productImage.buffer, 
    };

    const result = await productCollection.insertOne(newProduct);
    res.send({ insertedId: result.insertedId });
  } catch (error) {
    console.error("Product insertion error:", error);
    res.status(500).send({ error: "Failed to insert product" });
  }
});

    
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
      const query = { productId: id }; 
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });


   app.post('/reviews/:id', async (req, res) => {
  const productId = req.params.id;
  const reviewsDoc = req.body;

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

// payment
app.post('/create-payment', async (req, res) => {
  const { price } = req.body;

  try {
    const amount = parseInt(price * 100); 
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).send({ error: 'Failed to create payment intent' });
  }
});

//  Get Payments by Email
app.get('/subscription-status/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const userPayment = await paymentCollection.findOne({
      email: email,
      membership: true
    });

    if (userPayment) {
      res.send({ subscribed: true });
    } else {
      res.send({ subscribed: false });
    }
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).send({ error: 'Something went wrong' });
  }
});

//  Submit Membership Payment 
app.post('/payments', async (req, res) => {
  const payment = req.body;

  try {
    const paymentResult = await paymentCollection.insertOne(payment);
    res.send({ paymentResult });
  } catch (err) {
    console.error('Payment insert error:', err);
    res.status(500).send({ error: 'Failed to record payment' });
  }
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