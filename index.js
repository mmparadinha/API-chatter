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

//Database interactions
async function findAllUsers() {
    return db.collection('participants').find().toArray();
}

async function findUserByName(username) {
    return db.collection('participants').find({name: `${username}`}).toArray();
}

async function findMessages(username) {
    return db.collection('messages').find({
        $or: [
            {from: username},
            {to: {$in: ['Todos', username]} }
        ]
    }).toArray();
}

async function logInMessage(username) {
    return db.collection('messages').insertOne({
        from: username,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
    });
}

async function logOffMessage(username) {
    return db.collection('messages').insertOne({
        from: username,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
    });
}

async function logInUser(username) {
    return db.collection('participants').insertOne({
        name: username,
        lastStatus: Date.now()
    });
}

async function logOffUser(user) {
    return db.collection('participants').deleteOne(user);
}

async function insertMessage(username, to, text, type) {
    return db.collection('messages').insertOne({
        from: username,
        to: to,
        text: text,
        type: type,
        time: dayjs().format('HH:mm:ss')
    });
}

async function findMessageById(messageId) {
    return db.collection('messages').findOne({ _id: ObjectId(messageId) });
}

async function updateMessage(messageId, text) {
    return db.collection('messages').updateOne(
        { _id: ObjectId(messageId) },
        {$set: {text: text}},
    );
}

//Get participants and messages
app.get('/participants', async function (req, res) {
    const participants = await findAllUsers();

    try {
        res.send(participants);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/messages', async function (req, res) {
    const { limit } = req.query;
    const { user } = req.headers;

    const loggedIn = await findUserByName(user);
    if (loggedIn.length === 0) {return res.status(422).send('Please login again')};

    const messages = await findMessages(user);
    res.send(messages.slice(-limit));
});

//Post participants and messages
app.post('/participants', async function (req, res) {
    let { name } = req.body;
    const schemaUsername = Joi.string().required();

    if (typeof name !== 'string') {return res.sendStatus(400)};
    name = stripHtml(name).result.trim();

    const loggedIn = await findUserByName(name);
    if (loggedIn.length !== 0) {return res.status(409).send('Name already in use')};

    const { error } = schemaUsername.validate(name);
    if (error) {return res.status(422).send(error.details[0].message)};

    try {
        await logInUser(name);
        await logInMessage(name);
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    } 
});

app.post('/messages', async function (req, res) {
    const { to, type } = req.body;
    let { text } = req.body;
    const { user } = req.headers;
    const schemaMessage = Joi.object ({
        to: Joi.string().alphanum().required(),
        text: Joi.string().required(),
        type: Joi.string().required().valid('message', 'private_message')
    });

    if (typeof text !== 'string') {return res.sendStatus(400)};
    text = stripHtml(text).result.trim();

    const loggedIn = await findUserByName(user);
    if (loggedIn.length === 0) {return res.status(422).send('You are not online, please login again!')};

    const { error } = schemaMessage.validate({
        to: to,
        text: text,
        type: type,
    });
    if (error) {return res.status(422).send(error.details[0].message)};

    try {
        await insertMessage();
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

    const message = await findMessageById(messageId);
    if (!message) {return res.sendStatus(404)};
    if (user !== message.from) {return res.sendStatus(401)};
    
    try {
        await db.collection('messages').deleteOne(message);
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//Modify message
app.put('/messages/:messageId', async function (req, res) {
    let { text } = req.body;
    const { user } = req.headers;
    const { messageId } = req.params;
    const schemaMessage = Joi.string().required();

    if (typeof text !== 'string') {return res.sendStatus(400)};
    text = stripHtml(text).result.trim();

    const loggedIn = await findUserByName(user);
    if (loggedIn.length === 0) {return res.status(422).send('You are not online, please login again!')};

    const message = await findMessageById(messageId);
    if (!message) {return res.sendStatus(404)};
    if (user !== message.from) {return res.sendStatus(401)};

    const { error } = schemaMessage.validate(text);
    if (error) {return res.status(422).send(error.details[0].message)};

    try {
        await updateMessage(messageId, text);
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//Participants status and activity
app.post('/status', async function (req, res) {
    const { user } = req.headers;
    if (!user) {return res.sendStatus(404)};

    try {
        await db.collection('participants').updateOne( {name: user}, {$set: {lastStatus: Date.now()}});
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

async function isActive() {
    const participants = await findAllUsers();

    participants.forEach(participant => {
        const timeNow = Date.now();
        if (timeNow - participant.lastStatus > 10000) {
            logOffUser(participant);
            logOffMessage(participant.name);
        }
    });
}

setInterval(isActive, 15000);

app.listen(5000, console.log('Listening at 5000!'));