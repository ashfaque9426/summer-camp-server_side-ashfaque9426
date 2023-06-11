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
    // console.log(authorization)
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
        const studentsAddedClasses = client.db('summerSchoolCluster').collection('studentPrefferedClasses');
        const paymentCollection = client.db('summerSchoolCluster').collection('paymentCollectionData');

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

        // get all payment pending classes from collection for a specifiq user
        app.get('/pendingClasses/:email', verifyJWT, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;

            if(decodedEmail !== email) {
                return res.status(403).send({error: true, message: "Forbidden Access"})
            }

            const query = {email: email, payment: 'pending'}

            const result = await studentsAddedClasses.find(query).toArray();
            res.send(result);
        });

        // getting specifiq class selected via student by id
        app.get('/selectedClass/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id), payment: "pending"};

            const result = await studentsAddedClasses.findOne(query);
            res.send(result);
        });

        // get all the classes after succefull payment
        app.get('/getPaidClasses/:email', verifyJWT, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            
            if (decodedEmail !== email) return res.status(403).send({ error: true, message: 'Forbidden Access' });

            const filter = {email: email, payment: 'paid'}
            const result = await studentsAddedClasses.find(filter).toArray();
            res.send(result);
        });

        // sorted data for student added after successfull payment(history)
        app.get('/sortedPaidClasses/:email', verifyJWT, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;

            if(decodedEmail !== email) return res.status(403).send({error: true, message: 'Forbidden Access'});

            const filter = {email: email};
            const result = await paymentCollection.find(filter).sort({$natural: -1}).toArray();
            res.send(result);
        });

        // get instructor classes
        app.get('/getInstructorClasses/:email', verifyJWT, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;

            if (decodedEmail !== email) return res.status(403).send({ error: true, message: "Forbidden Access" });

            const query = {instructorEmail: email}

            const result = await allClasses.find(query).toArray();
            res.send(result);
        });

        // get all classes for admin
        app.get('/getAllClassForAdmin/:email', verifyJWT, verifyAdmin, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;

            if(decodedEmail !== email) return res.status(401).send({message: "Unauthorized Access"});

            const result = await allClasses.find().toArray();
            res.send(result);
        });

        // posting a user after registration to the allUsers collection
        app.post('/newUser', async(req, res) => {
            const userData = req.body;
            const query = {email: req.body.email};
            const existedUser = await allUsersCollection.findOne(query);
            if (existedUser) {
                return res.send({ message: 'user already existed to the server' });
            }
            const result = await allUsersCollection.insertOne(userData);
            res.send(result);
        });

        // posting students preffered classes
        app.post('/studentsClass/:id', verifyJWT, async(req, res) => {
            const email = req.decoded.email;
            const id = req.params.id;
            const receivedClass = req.body;
            const className = receivedClass.className;
            const query = {classId: id, className: className, email: email};

            const existedClass = await studentsAddedClasses.findOne(query);
            if (existedClass) return res.send({message: "Class already added to database"});

            receivedClass.email = email;
            receivedClass.payment = "pending";

            const result = await studentsAddedClasses.insertOne(receivedClass);
            res.send(result);

        });

        // create payment intent api
        app.post('/create-payment-intent', verifyJWT, async(req, res) => {
            const {price} = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({clientSecret: paymentIntent.client_secret});
        });

        // storing payment related data and updating required field data
        app.post('/payments', verifyJWT, async(req, res) => {
            const paymentData = req.body;
            const id = paymentData.classId;
            const instructorEmail = paymentData.instructorEmail;
            const studentEmail = paymentData.studentEmail;
            const className = paymentData.className;
            const paymentDate = paymentData.date;

            const classFromAllClasses = await allClasses.findOne({ _id: new ObjectId(id), className: className });
            const updatedAvailableSeats = classFromAllClasses.availableSeats > 0 ? classFromAllClasses.availableSeats - 1 : 0;
            const updatedNumberOfStudents = classFromAllClasses.numberOfStudents + 1;

            const filter = { _id: new ObjectId(id), className: className };

            const updateDoc = {
                $set: {
                    availableSeats: updatedAvailableSeats,
                    numberOfStudents: updatedNumberOfStudents
                }
            }
            await allClasses.updateOne(filter, updateDoc);

            const filterOne = { email: instructorEmail };

            const updateDocOne = {
                $set: {
                    numberOfStudents: updatedNumberOfStudents
                }
            }

            await allUsersCollection.updateOne(filterOne, updateDocOne);

            const filterTwo = { email: studentEmail, className: className }

            const updateDocTwo = {
                $set: {
                    payment: "paid"   
                }
            }

            await studentsAddedClasses.updateOne(filterTwo, updateDocTwo);

            const paymentObj = {
                purchase: className,
                email: paymentData.email,
                transactionId: paymentData.transactionId,
                paid: paymentData.price,
                date: paymentDate,
                status: paymentData.status
            }

            const result = paymentCollection.insertOne(paymentObj);
            res.send(result);

        });

        // add a class api so do update required fields
        app.post('/addAClass/:email', verifyJWT, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            const addedClass = req.body;
            const instructorEmail = req.body.instructorEmail;
            const className = req.body.className;

            if(decodedEmail !== email) return res.status(403).send({error: true, message: "Forbidden Access"});

            const query = { email: instructorEmail };

            await allUsersCollection.updateOne(query, { $push: { nameOfClasses: className } });
            const findUser = await allUsersCollection.findOne(query);
            console.log(findUser)
            const newNumberOfClass = findUser.nameOfClasses.length > 0 ? findUser.nameOfClasses.length : 1;
            const updateDoc = {
                $set: {
                    numberOfClasses: newNumberOfClass
                }
            }
            await allUsersCollection.updateOne(query, updateDoc);

            const result = await allClasses.insertOne(addedClass);
            res.send(result);
        });

        // handle approve update
        app.patch('/updateStatus/:id/:email/:status', verifyJWT, verifyAdmin, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            const id = req.params.id;
            const status = req.params.status;

            if(decodedEmail !== email) return res.status(401).send({message: "Unauthorized Access"});

            const query = {_id: new ObjectId(id)};
            const updateDoc = {
                $set: {
                    status: status
                }
            }
            const options = { upsert: true };

            const result = await allClasses.updateOne(query, updateDoc, options);
            res.send(result);
        });

        // handle feedback from admin
        app.patch('/handleFeedback/:email/:id', verifyJWT, verifyAdmin, async(req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            const id = req.params.id;
            const feedback = req.body.feedback;
            console.log(id, feedback)

            if(decodedEmail !== email) return res.status(403).send({message: "Forbidden Access"});

            const query = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    feedback: feedback
                }
            }

            const result = await allClasses.updateOne(query, updateDoc, options);
            res.send(result);
        });

        // delete operation on students selected pending unpaid classes api
        app.delete('/studentsClass/:id/:email', verifyJWT, async(req, res)=> {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            const id = req.params.id;

            if(decodedEmail !== email) return res.status(403).send({message: "forbidden access"});

            const query = { _id: new ObjectId(id), email: email, payment: 'pending' }
            const result = await studentsAddedClasses.deleteOne(query);
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


app.get('/', (req, res) => {
    res.send("Summer School Server is running");
});

app.listen(port, () => console.log(`Summer School server is running on Port: ${port}`));