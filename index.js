const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// خريطة لحفظ حالة لعبة XO لكل شات
const xoGames = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم تشغيل [بوت اسبيد] بنجاح وربطه برقمك والألعاب جاهزة!');
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

        // الرد على كلمة "بوت" أو الأوامر المعتادة
        if (cmdLower === 'بوت' || cmdLower === '/menu' || cmdLower === '/help' || cmdLower === 'اوامر') {
            await sock.sendMessage(sender, { 
                text: "🤖 *مرحباً بك في (بوت اسبيد) للألعاب والأوامر!*\n\n" +
                      "قائمة الأوامر المتاحة:\n" +
                      "📌 `بوت` أو `/menu` - عرض قائمة الأوامر الرئيسية\n" +
                      "❌ `/xo` - لبدء لعبة XO جديدة\n" +
                      "🔢 `/faza` - فوازير وذكاء سريع\n" +
                      "🧠 `/game` - مسابقة الأسئلة التاريخية\n" +
                      "👋 `السلام عليكم` - ترحيب تلقائي" 
            });
        } 
        
        // 2. لعبة XO
        else if (cmdLower === '/xo') {
            xoGames[sender] = {
                board: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'],
                turn: '❌'
            };
            
            await sock.sendMessage(sender, { 
                text: "❌⭕ *بدأت لعبة XO مع بوت اسبيد!* (أنت تلعب بـ ❌)\n" +
                      "اكتب رقم الخانة (من 1 لـ 9) عشان تحط الرمز بتاعك.\n\n" +
                      getBoardString(xoGames[sender].board) + 
                      "\n\nاكتب مثلاً: `/play 5` عشان تلعب في النص." 
            });
        }

        // تفاعل لاعب الـ XO
        else if (cmdLower.startsWith('/play ')) {
            const pos = parseInt(command.split(' ')[1]) - 1;
            if (xoGames[sender] && pos >= 0 && pos <= 8) {
                let game = xoGames[sender];
                if (typeof game.board[pos] === 'number' || (game.board[pos] !== '❌' && game.board[pos] !== '⭕')) {
                    game.board[pos] = game.turn;
                    game.turn = game.turn === '❌' ? '⭕' : '❌';
                    
                    await sock.sendMessage(sender, { 
                        text: "حركتك تمت:\n\n" + getBoardString(game.board) + "\n\nدور اللاعب التاني (اكتب `/play [رقم]`) العب خانة فاضية." 
                    });
                } else {
                    await sock.sendMessage(sender, { text: "⚠️ الخانة دي مشغولة، اختار خانة فاضية غيرها!" });
                }
            } else {
                await sock.sendMessage(sender, { text: "⚠️ اختار رقم صح من 1 لـ 9 (مثال: `/play 3`)" });
            }
        }

        // 3. لعبة فوازير سريعة
        else if (cmdLower === '/faza') {
            await sock.sendMessage(sender, { 
                text: "🧩 *فزورة من بوت اسبيد:*\n" +
                      "حاجة أسمر من الليل، ومفيش غير عين واحدة، بس بتشوف بيها كل الدنيا.. إيه هي؟\n\n" +
                      "*(فكر كويس واكتب إجابتك)*" 
            });
        }

        // 4. لعبة الأسئلة التاريخية
        else if (cmdLower === '/game' || cmdLower === 'لعبة') {
            await sock.sendMessage(sender, { 
                text: "🧠 *سؤال تحدي تاريخي من بوت اسبيد:*\n\n" +
                      "ترتبط محاولة لويس الخامس عشر الدبلوماسية للحصول على مصر عام 1769 بـ:\n\n" +
                      "أ) رغبته في تقويض النفوذ الإنجليزي في الهند.\n" +
                      "ب) استغلال الصراع بين العثمانيين وروسيا.\n\n" +
                      "*(اكتب حرف الإجابة: أ أو ب)*" 
            });
        }
        
        else if (cmdLower.includes('السلام عليكم')) {
            await sock.sendMessage(sender, { text: "وعليكم السلام يا غالي! اكتب كلمة *بوت* عشان تشوف الأوامر وتلعب معايا 🚀" });
        }
    });
}

function getBoardString(b) {
    return `${b[0]} | ${b[1]} | ${b[2]}\n` +
           `-----------\n` +
           `${b[3]} | ${b[4]} | ${b[5]}\n` +
           `-----------\n` +
           `${b[6]} | ${b[7]} | ${b[8]}`;
}

startBot();
              
