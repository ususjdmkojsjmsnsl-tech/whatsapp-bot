const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');

const userScores = {};
const activeGames = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        // حط رقم هاتفك هنا مع رمز الدولة (مثال: +20 للمصر)
        const phoneNumber = "+20XXXXXXXXX"; 
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n🔑 كود الربط الخاص بك هو: [ ${code} ]\n`);
            } catch (error) {
                console.log("خطأ في طلب كود الإقتران:", error);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم تشغيل بوت اسبيد بنجاح وجاهز للاستخدام!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const command = textMessage.trim();
        const cmdLower = command.toLowerCase();

        if (!userScores[sender]) userScores[sender] = 0;

        // 1. الأوامر الرئيسية
        if (cmdLower === 'بوت' || cmdLower === '/menu' || cmdLower === 'اوامر') {
            await sock.sendMessage(sender, { 
                text: "مرحباً بك في عالم ألعاب بوت اسبيد 🚀\n\nرصيد نقاطك: " + userScores[sender] + " نقطة\n\nقائمة الأوامر:\n- /xo : لعبة XO\n- /animal : احزر اسم الحيوان\n- /guess : احزر الشيء\n- /setprofile : لتغيير صورة البروفايل (أرسل الصورة مع الأمر)\n- نقاطي : لمعرفة نقاطك\n- بحبك : غزل ودردشة" 
            });
        }
        else if (cmdLower === 'نقاطي' || cmdLower === '/score') {
            await sock.sendMessage(sender, { text: "إجمالي نقاطك الحالية هو: " + userScores[sender] + " نقطة 🌟" });
        }
        else if (cmdLower.includes('بحبك')) {
            await sock.sendMessage(sender, { text: "وأنا أموت فيك وفي التفاعل معاك يا أسطورة الموبايل ❤️" });
        }

        // 2. لعبة XO
        else if (cmdLower === '/xo') {
            activeGames[sender] = { type: 'xo', board: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], turn: 'X' };
            await sock.sendMessage(sender, { text: "بدأت لعبة XO! اكتب رقم الخانة من 1 لـ 9 هكذا: /play رقم" });
        }
        else if (cmdLower.startsWith('/play ') && activeGames[sender]?.type === 'xo') {
            const pos = parseInt(command.split(' ')[1]) - 1;
            let game = activeGames[sender];
            if (pos >= 0 && pos <= 8) {
                game.board[pos] = game.turn;
                game.turn = game.turn === 'X' ? 'O' : 'X';
                userScores[sender] += 5;
                await sock.sendMessage(sender, { text: "حركة ممتازة! تم إضافة 5 نقاط. 🌟" });
            }
        }

        // 3. لعبة احزر الحيوان
        else if (cmdLower === '/animal') {
            activeGames[sender] = { type: 'animal' };
            await sock.sendMessage(sender, { text: "لعبة احزر الحيوان: ملك الغابة وصوته زئير، مين أنا؟ (اكتب إجابتك)" });
        }
        else if (activeGames[sender]?.type === 'animal') {
            if (cmdLower.includes('اسد') || cmdLower.includes('أسد')) {
                userScores[sender] += 20;
                await sock.sendMessage(sender, { text: "إجابة صحيحة! كسبت 20 نقطة. نقاطك الحالية: " + userScores[sender] });
                delete activeGames[sender];
            } else {
                await sock.sendMessage(sender, { text: "إجابة خاطئة، حاول تاني!" });
            }
        }

        // 4. أمر تغيير صورة البروفايل (/setprofile)
        else if (cmdLower === '/setprofile' || cmdLower === 'setprofile') {
            const imageMessage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            
            if (imageMessage) {
                try {
                    await sock.sendMessage(sender, { text: "⏳ جاري تحميل الصورة وتحديث بروفايل الواتساب..." });
                    const stream = await downloadContentFromMessage(imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.from([...buffer, ...chunk]);
                    }
                    await sock.updateProfilePicture(sock.user.id, buffer);
                    await sock.sendMessage(sender, { text: "✅ تم تحديث صورة البروفايل بنجاح يا فنان! 🖼️" });
                } catch (e) {
                    await sock.sendMessage(sender, { text: "⚠️ حدث خطأ أثناء تغيير الصورة، حاول مرة أخرى." });
                }
            } else {
                await sock.sendMessage(sender, { text: "📸 يرجى إرسال الصورة ومعها الأمر `/setprofile` في نفس الرسالة (أو الرد على الصورة بالأمر) لتعيينها كصورة بروفايل!" });
            }
        }
    });
}

startBot();
