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
    const { limit } = req.query;
    const { user } = req.headers;

    const messages = await db.collection('messages').find().toArray();
    const messagesUser = messages.filter(message => (message.from === user || message.to === 'Todos' || message.to === user));

    try {
        if (limit) {
            res.send(messagesUser.slice(-limit));
        } else {
            res.send(messagesUser);
        }
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

app.post('/messages', async function (req, res) {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    
    // const schema = Joi.string().min(1);
    // const { value, error } = schema.validate(req.body.name);
    // const loggedIn = await db.collection('messages').find({name: `${value}`}).toArray();

    // if (loggedIn.length !== 0) return res.status(409).send('Name already in use');
    // if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('messages').insertOne({
            from: user,
            to: to,
            text: text,
            type: type,
            time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
    } 
});

//Status
app.post('/status', async function (req, res) {
    const { user } = req.headers;

    if (!user) {
        res.sendStatus(404);
    } else {
        db.collection('participants').updateOne(
            {name: user},
            {$set: {lastStatus: Date.now()}}
        );
        res.sendStatus(200);
    }
});

app.listen(5000, console.log('Listening at 5000!'));