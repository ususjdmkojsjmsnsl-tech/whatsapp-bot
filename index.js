const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// قواعد بيانات الألعاب والنقاط لحفظ تقدم كل مستخدم
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
        // حط رقمك هنا برمز الدولة (مثال: مصر +20)
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
            console.log('✅ تم تشغيل [بوت اسبيد] بكامل الألعاب والنقاط بنجاح!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!textMessage) return;
        const command = textMessage.trim();
        const cmdLower = command.toLowerCase();

        // تهيئة نقاط المستخدم إذا لمש تكن موجودة
        if (!userScores[sender]) userScores[sender] = 0;

        // 1. قائمة الأوامر الرئيسية
        if (cmdLower === 'بوت' || cmdLower === '/menu' || cmdLower === 'اوامر') {
            await sock.sendMessage(sender, { 
                text: "🤖 *مرحباً بك في عالم ألعاب (بوت اسبيد)* 🚀\n\n" +
                      "📊 *رصيد نقاطك:* `" + userScores[sender] + "` نقطة\n\n" +
                      "🎮 *قائمة الألعاب والترفيه:*:\n" +
                      "❌ `/xo` - لعبة XO التنافسية\n" +
                      "🦁 `/animal` - لعبة (احزر اسم الحيوان)\n" +
                      "🎁 `/guess` - لعبة (احزر الشئ المخفي)\n" +
                      "❤️ `بحبك` أو `غزل` - عبارات حب لطيفة\n" +
                      "🖼️ `/setprofile` - لتغيير بروفايل الواتساب بصورة جديدة\n" +
                      "🏆 `نقاطي` - لمعرفة رصيد نقاطك وحجم تفاعلك" 
            });
        }

        // 2. أمر الاستعلام عن النقاط
        else if (cmdLower === 'نقاطي' || cmdLower === '/score') {
            await sock.sendMessage(sender, { text: `🏆 رائع يا بطل! إجمالي نقاطك الحالية هو: *[ ${userScores[sender]} نقطة ]* 🌟 استمر في اللعب لجمع المزيد!` });
        }

        // 3. أوامر الحب والسرور
        else if (cmdLower.includes('بحبك') || cmdLower === 'بحبك يا بوت') {
            await sock.sendMessage(sender, { text: "❤️ يا هلا بقلبي! وأنا أموت فيك وفي التفاعل معاك يا أسطورة الموبايل 😍✨" });
        }
        else if (cmdLower === 'غزل' || cmdLower === 'قول شعر') {
            await sock.sendMessage(sender, { text: "🌹 ألا يا طير يا مسافر تعنى.. وصل سلامي لمن سكن روحي وعيني، منور الشات كله يا غالي! 🎶" });
        }

        // 4. لعبة XO
        else if (cmdLower === '/xo') {
            activeGames[sender] = { type: 'xo', board: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'], turn: '❌' };
            await sock.sendMessage(sender, { text: "❌⭕ *بدأت معركة XO!* (أنت تلعب بـ ❌)\nاكتب رقم الخانة (من 1 لـ 9) هكذا: `/play رقم`\n\n" + getBoardString(activeGames[sender].board) });
        }
        else if (cmdLower.startsWith('/play ') && activeGames[sender]?.type === 'xo') {
            const pos = parseInt(command.split(' ')[1]) - 1;
            let game = activeGames[sender];
            if (pos >= 0 && pos <= 8 && (typeof game.board[pos] === 'number' || (game.board[pos] !== '❌' && game.board[pos] !== '⭕'))) {
                game.board[pos] = game.turn;
                game.turn = game.turn === '❌' ? '⭕' : '❌';
                userScores[sender] += 5; // كسب 5 نقاط لكل حركة صحيحة
                await sock.sendMessage(sender, { text: `حركة ممتازة! (+5 نقاط 🌟)\n\n` + getBoardString(game.board) });
            } else {
                await sock.sendMessage(sender, { text: "⚠️ الخانة مشغولة أو رقم خطأ، جرب خانة غيرها!" });
            }
        }

        // 5. لعبة (احزر اسم الحيوان)
        else if (cmdLower === '/animal') {
            activeGames[sender] = { type: 'animal', answer: 'أسد' };
            await sock.sendMessage(sender, { 
                text: "🦁 *لعبة احزر اسم الحيوان:*\n\n" +
                      ""أنا ملك الجافا والبراري، صوتي زئير ويرهب الغابة كلها، مين أنا؟ 👑\n\n" +
                      "*(اكتب إجابتك مباشرة في رسالة)*" 
            });
        }
        else if (activeGames[sender]?.type === 'animal') {
            if (cmdLower.includes('أسد') || cmdLower.includes('اسد')) {
                userScores[sender] += 20; // مكافأة 20 نقطة للإجابة الصحيحة
                await sock.sendMessage(sender, { text: `🎉 إجابة صحيحة 100%! لقد فزت بـ *20 نقطة* 🌟\nنقاطك الحالية: ${userScores[sender]}` });
                delete activeGames[sender];
            } else {
                await sock.sendMessage(sender, { text: "❌ إجابة خاطئة يا وحش، فكر كويس وحاول تاني!" });
            }
        }

        // 6. لعبة (احزر الشيء المخفي)
        else if (cmdLower === '/guess') {
            activeGames[sender] = { type: 'guess', answer: 'تليفون' };
            await sock.sendMessage(sender, { 
                text: "🎁 *لعبة احزر الشيء المخفي:*\n\n" +
                      "شيء في جيبك لا يفارقك طوال اليوم، تنظر إليه مئات المرات وتلعب عليه ألعاب وتتحدث معي من خلاله.. فما هو؟ 📱\n\n" +
                      "*(اكتب اسم الشيء)*" 
            });
        }
        else if (activeGames[sender]?.type === 'guess') {
            if (cmdLower.includes('تليفون') || cmdLower.includes('موبايل') || cmdLower.includes('هاتف')) {
                userScores[sender] += 25; // مكافأة 25 نقطة
                wallMsg = `🎉 ذكي جداً! نعم إنه الهاتف، كسبت *25 نقطة* جديدة 🌟\nإجمالي نقاطك الآن: ${userScores[sender]}`;
                await sock.sendMessage(sender, { text: wallMsg });
                delete activeGames[sender];
            } else {
                await sock.sendMessage(sender, { text: "❌ للاسف مش هو، حاول تفكر تاني!" });
            }
        }

        // 7. أمر تغيير صورة البروفايل (setprofile)
        else if (cmdLower === '/setprofile' || cmdLower === 'setprofile') {
            // التحقق إذا كان المرسل أرسل صورة مع الأمر
            const imageMessage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            
            if (imageMessage) {
                try {
                    await sock.sendMessage(sender, { text: "⏳ جاري تحميل الصورة وتحديث بروفايل الواتساب الخاص بك..." });
                    // تنزيل الصورة وتحديث البروفايل الشخصي للبوت أو الرقم المرتبط
                    const stream = await require('@whiskeysockets/baileys').downloadContentFromMessage(imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.from([...buffer, ...chunk]);
                    }
                    await sock.updateProfilePicture(sock.user.id, buffer);
                    await sock.sendMessage(sender, { text: "✅ تم تحديث صورة البروفايل بنجاح يا فنان! 🖼️✨" });
                } catch (e) {
                    await sock.sendMessage(sender, { text: "⚠️ حدث خطأ أثناء تغيير الصورة، تأكد من إرفاق الصورة بشكل صحيح." });
                }
            } else {
                await sock.sendMessage(sender, { text: "📸 يرجى إرسال الصورة مع كتابة الكود هكذا: `/setprofile` (أو قم بالرد على الصورة بكتابة الأمر) ليتم تعيينها كصورة بروفايل!" });
            }
        }
    });
}

function getBoardString(b) {
    return `${b[0]} | ${b[1]} | ${b[2]}\n-----------\n${b[3]} | ${b[4]} | ${b[5]}\n-----------\n${b[6]} | ${b[7]} | ${b[8]}`;
}

startBot();
