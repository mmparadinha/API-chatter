import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import Joi from 'joi';
import { stripHtml } from "string-strip-html";

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
        res.sendStatus(500);
    }
});

app.get('/messages', async function (req, res) {
    const { limit } = req.query;
    const { user } = req.headers;

    const loggedIn = await db.collection('participants').find({name: `${user}`}).toArray();
    if (loggedIn.length === 0) return res.status(422).send('Please login again');

    const messages = await db.collection('messages').find().toArray();
    const messagesUser = messages.filter(message => (message.from === user || message.to === 'Todos' || message.to === user));

    if (limit) {
        res.send(messagesUser.slice(-limit));
    } else {
        res.send(messagesUser);
    }
});

//Post participants and messages
app.post('/participants', async function (req, res) {
    const name = stripHtml(req.body.name).result.trim();
    const schemaUsername = Joi.string().alphanum().required();
    const { error } = schemaUsername.validate(name);
    const loggedIn = await db.collection('participants').find({name: `${name}`}).toArray();

    if (loggedIn.length !== 0) return res.status(409).send('Name already in use');
    if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('participants').insertOne({
            name: name,
            lastStatus: Date.now()
        })
        db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    } 
});

app.post('/messages', async function (req, res) {
    const { to, type } = req.body;
    const text = stripHtml(req.body.text).result.trim();
    const { user } = req.headers;
    const schemaMessage = Joi.object ({
        to: Joi.string().alphanum().required(),
        text: Joi.string().required(),
        type: Joi.string().required().valid('message', 'private_message')
    });

    const loggedIn = await db.collection('participants').find({name: `${user}`}).toArray();
    if (loggedIn.length === 0) return res.status(422).send('You are not online, please login again!');

    const { error } = schemaMessage.validate({
        to: to,
        text: text,
        type: type,
    });
    if (error) return res.status(422).send(error.details[0].message);

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
        res.sendStatus(500);
    } 
});

//Delete message
app.delete('/messages/:messageId', async (req, res) => {
    const { user } = req.headers;
    const { messageId } = req.params;

    const message = await db.collection('messages').findOne({ _id: ObjectId(messageId) });
    if (!message) return res.sendStatus(404);
    if (user !== message.from) return res.sendStatus(401);
    
    try {
        db.collection('messages').deleteOne(message);
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//Modify message
app.put('/messages/:messageId', async function (req, res) {
    const { to, type } = req.body;
    const text = stripHtml(req.body.text).result.trim();
    const { user } = req.headers;
    const { messageId } = req.params;
    const schemaMessage = Joi.object ({
        to: Joi.string().alphanum().required(),
        text: Joi.string().required(),
        type: Joi.string().required().valid('message', 'private_message')
    });

    const loggedIn = await db.collection('participants').find({name: `${user}`}).toArray();
    if (loggedIn.length === 0) return res.status(422).send('You are not online, please login again!');

    const message = await db.collection('messages').findOne({ _id: ObjectId(messageId) });
    if (!message) return res.sendStatus(404);
    if (user !== message.from) return res.sendStatus(401);

    const { error } = schemaMessage.validate({
        to: to,
        text: text,
        type: type,
    });
    if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('messages').updateOne(
            { _id: ObjectId(messageId) },
            {$set: {
                to: to,
                text: text,
                type: type
            }},
        );
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    } 
});

//Participants status and activity
app.post('/status', async function (req, res) {
    const { user } = stripHtml(req.headers).result.trim();

    if (!user) {
        res.sendStatus(404);
    } else {
        try {
            db.collection('participants').updateOne(
                {name: user},
                {$set: {lastStatus: Date.now()}}
            );
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    }
});

async function isActive() {
    console.log('conferindo os ativos')
    const participants = await db.collection('participants').find().toArray();

    participants.forEach(participant => {
        const timeNow = Date.now();
        if (timeNow - participant.lastStatus > 9999) {
            db.collection('participants').deleteOne(participant);
            db.collection('messages').insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            });
        }
    });
}

//setInterval(isActive, 15000);

app.listen(5000, console.log('Listening at 5000!'));