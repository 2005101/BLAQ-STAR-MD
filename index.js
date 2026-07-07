const express = require('express')
const path = require('path')
const fs = require('fs')
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode')
const axios = require('axios');
const { exec } = require('child_process');

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static('public'))
app.use(express.json())

const BOT_NAME = 'DARK-EYE OFC';
const OWNER = '263783546271@s.whatsapp.net'; // CHANGE THIS
const REPO = 'https://github.com/2005101/BLAQ-STAR-MD';
const BOT_IMAGE = 'https://files.catbox.moe/fu932c.jpg'; // YOUR LOGO
const CHANNEL = 'https://whatsapp.com/channel/0029Vb6zh00FcowG8euO480M';

let mode = 'public';
let sudo = [OWNER];
let antidelete = true;
let autotyping = false;
let autoread = false;
let antilink = true;
let antimention = true;
let alwaysonline = false;

let sock
let qr_data = ""
let pairing_requested = false
let pairing_number = ""

// ===== BOX FUNCTION =====
function box(title, data = {}) {
    let text = `*╭───❰ ${BOT_NAME} ❱───╮*\n*│* ${title}\n`;
    for(let key in data){
        text += `*│* ◇ *${key.toUpperCase()}:* ${data[key]}\n`;
    }
    text += `*╰────────────────╯*\n\n> *DARK-EYE OFFICIAL DEV 2K*`;
    return text;
}

// ===== MENU FUNCTION =====
function getMenu(prefix = '.') {
    return `*╔═══❰ DARK-EYE OFC ❱═══╗*
*║* 👑 *OWNER:* @${OWNER.split('@')[0]}
*╚══════════════════╝*

*╭───❰ OWNER ❱───╮*
|♤ ${prefix}mode
|♤ ${prefix}public 
|♤ ${prefix}private
|♤ ${prefix}groups 
|♤ ${prefix}inbox
*╰────────────╯*

*╭───❰ SYSTEM ❱───╮*
|♤ ${prefix}alive 
|♤ ${prefix}ping
|♤ ${prefix}uptime 
|♤ ${prefix}update
|♤ ${prefix}repo 
|♤ ${prefix}menu
*╰─────────────╯*

*╭────❰ GROUP ❱────╮*
|♤ ${prefix}glink
|♤ ${prefix}tagall
|♤ ${prefix}groupinfo 
|♤ ${prefix}listadmin
|♤ ${prefix}kick
|♤ ${prefix}close 
|♤ ${prefix}open
|♤ ${prefix}setgname 
|♤ ${prefix}del
|♤ ${prefix}antilink 
|♤ ${prefix}antimention
*╰────────────╯*

*╭────❰ DOWNLOAD ❱───╮*
|♤ ${prefix}song 
|♤ ${prefix}play
|♤ ${prefix}video
|♤ ${prefix}movie
*╰───────────────╯*

*╭───❰ AI ❱───╮*
|♤ ${prefix}ai 
|♤ ${prefix}meta
*╰───────────╯*

*╭───❰ SETTINGS ❱───╮*
|♤ ${prefix}listsudo 
|♤ ${prefix}addsudo
|♤ ${prefix}antidelete
|♤ ${prefix}autoread
|♤ ${prefix}autotyping
*╰───────────────╯*
♤♤♤♡♡♡♧♧♧□□□◇◇◇○○○☆☆☆
> *©𝑝𝑜𝑤𝑒𝑟𝑒𝑑 𝑏𝑦 𝐃𝐀𝐑𝐊 𝐄𝐘𝐄 𝐎𝐅𝐂 𝐃𝐄𝐕*
> Follow Channel: ${CHANNEL}`
}

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false, // We use website QR instead
        browser: Browsers.macOS('Chrome')
    });
    
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            qr_data = await QRCode.toDataURL(qr) // Save QR for website
        }
        
        if(connection === 'close') {
            qr_data = ""
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) start();
        }
        if(connection === 'open') {
            console.log(`\n${BOT_NAME} ✅ CONNECTED\n`);
            qr_data = ""
        }
        
        // Auto request pairing code if requested from website
        if(pairing_requested && pairing_number && connection === 'connecting') {
            try {
                const code = await sock.requestPairingCode(pairing_number);
                console.log(`Pair Code: ${code}`)
                global.last_pair_code = code
            } catch(e) {}
            pairing_requested = false
        }
    });

    const deletedMsgs = new Map();

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if(!msg.message || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const prefix = '♤';
        if(!text.startsWith(prefix)) return;
        const args = text.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const metadata = isGroup? await sock.groupMetadata(jid) : {};
        const isAdmin = isGroup? metadata.participants.find(p => p.id === sender)?.admin : false;
        const isOwner = sudo.includes(sender);

        if(mode === 'private' && !isOwner) return;
        if(mode === 'groups' && !isGroup && !isOwner) return;
        if(mode === 'inbox' && isGroup && !isOwner) return;

        if(autotyping) await sock.sendPresenceUpdate('composing', jid);
        if(autoread) await sock.readMessages([msg.key]);

        // ===== MENU WITH LOGO + FORWARD =====
        if(command === 'menu' || command === 'help'){
            await sock.sendMessage(jid, { 
                image: { url: BOT_IMAGE },
                caption: getMenu(prefix),
                contextInfo: {
                    mentionedJid: [OWNER],
                    forwardingScore: 1,
                    isForwarded: true,
                    externalAdReply: {
                        title: BOT_NAME,
                        body: "OFFICIAL NEWSLETTER",
                        thumbnailUrl: BOT_IMAGE,
                        sourceUrl: CHANNEL,
                        mediaType: 1,
                        showAdAttribution: true
                    }
                }
            }, { quoted: msg });
        }

        // ===== SYSTEM =====
        if(command === 'alive'){
            await sock.sendMessage(jid, { text: box('BOT STATUS', {NAME: BOT_NAME, STATUS: 'ONLINE ✅', MODE: mode, UPTIME: `${Math.floor(process.uptime()/60)} min`}) });
        }
        if(command === 'ping'){
            const start = Date.now();
            await sock.sendMessage(jid, { text: box('PING', {SPEED: `${Date.now() - start}ms`}) });
        }
        if(command === 'repo'){
            await sock.sendMessage(jid, { text: box('BOT REPOSITORY', {NAME: BOT_NAME, LINK: REPO, OWNER: '@'+OWNER.split('@')[0]}), mentions: [OWNER] });
        }

        // ===== OWNER COMMANDS =====
        if(command === 'mode' && isOwner){
            mode = args[0] || 'public';
            await sock.sendMessage(jid, { text: box('MODE CHANGED', {MODE: mode}) });
        }

        // ===== GROUP COMMANDS =====
        if(command === 'tagall' && isGroup){
            let txt = box('TAGALL', {GROUP: metadata.subject, TOTAL: metadata.participants.length}) + '\n\n';
            let mentions = [];
            metadata.participants.forEach((p,i) => { txt += `*${i+1}.♤ @${p.id.split('@')[0]}*\n`; mentions.push(p.id); });
            await sock.sendMessage(jid, { text: txt, mentions });
        }

        // ===== DOWNLOAD =====
if(command === 'song' || command === 'play'){
    await sock.sendMessage(jid, { text: box('DOWNLOAD', {INFO: 'Downloads coming soon. Website is live first'}) });
}

        // ===== AI =====
        if(command === 'ai' || command === 'meta'){
            await sock.sendMessage(jid, { text: box('DARK-EYE AI', {QUESTION: args.join(' '), ANSWER: 'Coming soon... Add your AI API here'}) });
        }
    });
}

start();

// ===== WEBSITE API ROUTES =====
// API for QR
app.get('/qr', (req,res) => {
  res.json({ qr: qr_data })
})

// API for Pair Code
app.get('/pair', async (req,res) => {
  const number = req.query.number
  pairing_requested = true
  pairing_number = number.replace(/[^0-9]/g, '')
  setTimeout(() => {
    res.json({ code: global.last_pair_code || "Generating..." })
  }, 3000)
})

app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.listen(PORT, () => console.log(`Website running on port ${PORT}`))
