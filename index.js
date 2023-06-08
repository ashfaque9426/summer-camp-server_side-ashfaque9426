const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require("dotenv").config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    console.log(authorization)
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }

    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACESS_TOKEN_SECRET, function (err, decoded) {
        if (err) return res.status(403).send({ error: true, message: "Access Denied" })
        req.decoded = decoded;
        next();
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ickmg5.mongodb.net/?retryWrites=true&w=majority`;
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
        client.connect();
        const allClasses = client.db('summerSchoolCluster').collection('allClasses');
        const allUsersCollection = client.db('summerSchoolCluster').collection('allUsers');

        // jwt api
        app.post('/jwt', (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send(token);
        });

        // verify admin middleware
        const verifyAdmin = async(req, res, next) => {
            const email = req.decoded.email;
            const query = {email: email};
            const user = await allUsersCollection.findOne(query);
            
            if(user?.role !== 'admin') return res.status(403).send({ error: true, message: "Unauthorized Access" })
            next();
        }

        // get all classes by hitting the bellow api
        app.get('/allClasses', async(req, res)=> {
            const query = { status: "approved"}
            const result = await allClasses.find(query).toArray();
            res.send(result);
        });

        // gets top classes based on the number of students
        app.get('/popularClasses', async(req, res) => {
            const query = { numberOfStudents: {$gte: 10 } };
            const result = await allClasses.find(query).toArray();
            res.send(result);
        });

        // gets all instructors from collection
        app.get('/instructors', async(req, res) => {
            const query = {role: 'instructor'};
            const result = await allUsersCollection.find(query).toArray();
            res.send(result);
        })

        // gets popular instructors from collection
        app.get('/popularInstructors', async(req, res) => {
            const query = {numberOfStudents: {$gte: 10}};
            const result = await allUsersCollection.find(query).toArray();
            res.send(result);
        });

        // required Middlewares
        // check Admin or not
        app.get('/allUsers/admin/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            if(req.decoded.email !== email) {
                return res.send({admin: false});
            }

            const query = {
                email: email
            }

            const user = await allUsersCollection.findOne(query);
            const result = {admin: user?.role === 'admin'}
            return res.send(result);
        });

        // check instructor or not
        app.get('/allUsers/instructor/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            if(req.decoded.email !== email) {
                return res.send({instructor: false});
            }

            const query = {
                email: email
            }

            const user = await allUsersCollection.findOne(query);
            const result = {instructor: user?.role === 'instructor'};
            res.send(result);
        });

        // check student or not
        app.get('/allUsers/student/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            if(req.decoded.email !== email) {
                return res.send({ student: false});
            }

            const query = {
                email: email
            }

            const user = await allUsersCollection.findOne(query);
            const result = {student: user?.role === 'student'};
            res.send(result);
        });

        // posting a user after registration to the allUsers collection
        app.post('/newUser', async(req, res) => {
            const userData = req.body;
            const result = await allUsersCollection.insertOne(userData);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Summer School Server is running");
});

app.listen(port, () => console.log(`Summer School server is running on Port: ${port}`));