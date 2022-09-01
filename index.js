import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import Joi from 'joi';

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
dayjs().format();

//Server connection
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("projeto12");
});


//Get participants and messages
app.get('/participants', async function (req, res) {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        console.error(error);
    }
});

app.get('/messages', async function (req, res) {
    try {
        const messages = await db.collection('messages').find().toArray();
        res.send(messages);
    } catch (error) {
        console.error(error);
    }
});

//Post participants and messages
app.post('/participants', async function (req, res) {
    const schema = Joi.string().min(1);
    const { value, error } = schema.validate(req.body.name);
    const loggedIn = await db.collection('participants').find({name: `${value}`}).toArray();

    if (loggedIn.length !== 0) return res.status(409).send('Name already in use');
    if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('participants').insertOne({
            name: value,
            lastStatus: Date.now()
        })
        db.collection('messages').insertOne({
            from: value,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
    } 
});




app.listen(5000, console.log('Listening at 5000!'));