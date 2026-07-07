const express = require('express')
const fs = require('fs')
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const yts = require('yt-search');
const ytDlp = require('yt-dlp-exec');
const QRCode = require('qrcode')
const axios = require('axios');
const { exec } = require('child_process');

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json()) // REMOVED static public folder

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
        text += `*│* *${key.toUpperCase()}:* ${data[key]}\n`;
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
| ${prefix}mode
| ${prefix}public 
| ${prefix}private
| ${prefix}groups 
| ${prefix}inbox
*╰────────────╯*

*╭───❰ SYSTEM ❱───╮*
| ${prefix}alive 
| ${prefix}ping
| ${prefix}uptime 
| ${prefix}update
| ${prefix}repo 
| ${prefix}menu
*╰─────────────╯*

*╭────❰ GROUP ❱────╮*
| ${prefix}glink
| ${prefix}tagall
| ${prefix}groupinfo 
| ${prefix}listadmin
| ${prefix}kick
| ${prefix}close 
| ${prefix}open
| ${prefix}setgname 
| ${prefix}del
| ${prefix}antilink 
| ${prefix}antimention
*╰────────────╯*

*╭────❰ DOWNLOAD ❱───╮*
| ${prefix}song 
| ${prefix}play
| ${prefix}video
| ${prefix}movie
*╰───────────────╯*

*╭───❰ AI ❱───╮*
| ${prefix}ai 
| ${prefix}meta
*╰───────────╯*

*╭───❰ SETTINGS ❱───╮*
| ${prefix}listsudo 
| ${prefix}addsudo
| ${prefix}antidelete
| ${prefix}autoread
| ${prefix}autotyping
*╰───────────────╯*

> *©𝑝𝑜𝑤𝑒𝑟𝑒𝑑 𝑏𝑦 𝐃𝐀𝐑𝐊 𝐄𝐘𝐄 𝐎𝐅𝐂 𝐃𝐄𝐕*
> Follow Channel: ${CHANNEL}`
}

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false,
        browser: Browsers.macOS('Chrome')
    });
    
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            qr_data = await QRCode.toDataURL(qr)
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
        
        if(pairing_requested && pairing_number && connection === 'connecting') {
            try {
                const code = await sock.requestPairingCode(pairing_number);
                console.log(`Pair Code: ${code}`)
                global.last_pair_code = code
            } catch(e) {}
            pairing_requested = false
        }
    });

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

        // ===== MENU =====
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

        // ===== OWNER =====
        if(command === 'mode' && isOwner){
            mode = args[0] || 'public';
            await sock.sendMessage(jid, { text: box('MODE CHANGED', {MODE: mode}) });
        }

        // ===== GROUP =====
        if(command === 'tagall' && isGroup){
            let txt = box('TAGALL', {GROUP: metadata.subject, TOTAL: metadata.participants.length}) + '\n\n';
            let mentions = [];
            metadata.participants.forEach((p,i) => { txt += `*${i+1}.♤ @${p.id.split('@')[0]}*\n`; mentions.push(p.id); });
            await sock.sendMessage(jid, { text: txt, mentions });
        }

        // ===== DOWNLOAD =====
        if(command === 'song' || command === 'play'){
            if(!args[0]) return await sock.sendMessage(jid, { text: box('SONG DOWNLOAD', {ERROR: 'Missing song name', EXAMPLE: '♤song faded'}) });
            let query = args.join(' ');
            const search = await yts(query);
            const video = search.videos[0];
            await sock.sendMessage(jid, { text: box('DOWNLOADING SONG', {NAME: video.title}) });
            const file = await ytDlp(video.url, { extractAudio: true, audioFormat: 'mp3', output: 'temp.mp3' });
            await sock.sendMessage(jid, { audio: fs.readFileSync('temp.mp3'), mimetype: 'audio/mp4', fileName: `${video.title}.mp3` });
            fs.unlinkSync('temp.mp3');
        }

        // ===== AI =====
        if(command === 'ai' || command === 'meta'){
            await sock.sendMessage(jid, { text: box('DARK-EYE AI', {QUESTION: args.join(' '), ANSWER: 'Coming soon... Add your AI API here'}) });
        }
    });
}

start();

// ===== WEBSITE API ROUTES =====
app.get('/qr', (req,res) => {
  res.json({ qr: qr_data })
})

app.get('/pair', async (req,res) => {
  const number = req.query.number
  pairing_requested = true
  pairing_number = number.replace(/[^0-9]/g, '')
  setTimeout(() => {
    res.json({ code: global.last_pair_code || "Generating..." })
  }, 3000)
})

// FIXED PANEL - NO PUBLIC FOLDER
app.get('/', (req,res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>👁️ DARK-EYE MD</title>
        <style>
            body { background: #0a0a0a; color: white; font-family: Arial; text-align: center; padding: 30px; }
            h1 { color: #00ff88; }
            .btn { background: #00ff88; color: black; padding: 15px 30px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px; }
            #qrimg { max-width: 300px; margin: 20px auto; }
        </style>
    </head>
    <body>
        <h1>DARK-EYE MD</h1>
        <p>Connect your WhatsApp</p>
        <button class="btn" onclick="showQR()">QR Code</button>
        <button class="btn" onclick="showPair()">Pair Code</button>
        <div id="result"></div>
        
        <script>
            async function showQR(){
                const r = await fetch('/qr'); const d = await r.json();
                document.getElementById('result').innerHTML = d.qr ? '<img id="qrimg" src="'+d.qr+'">' : 'Generating QR... Refresh';
            }
            async function showPair(){
                const num = prompt('Enter number with country code: 263783...');
                if(!num) return;
                const r = await fetch('/pair?number='+num); const d = await r.json();
                document.getElementById('result').innerHTML = '<h2>Code: '+d.code+'</h2><p>WhatsApp > Linked Devices</p>';
            }
        </script>
    </body>
    </html>
  `)
})

app.listen(PORT, () => console.log(`Website running on port ${PORT}`))
