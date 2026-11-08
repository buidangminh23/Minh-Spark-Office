const chars = (text: string) => [...new Set(Array.from(text.replace(/\s+/g, '')))];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));
const words = (text: string) => text.split(/\s+/).filter(Boolean);

export const SYMBOL_SETS: { name: string; symbols: string[] }[] = [
  { name: 'Thông dụng', symbols: chars('©®™℠§¶†‡•…–—«»‹›“”‘’„‚°№℃℉′″‰‱¦¡¿‽※⁂·¤ªº') },
  { name: 'Dấu câu & khoảng trắng', symbols: [...chars('!"#%&\'()*+,-./:;<=>?@[\\]^_`{|}~¨¯´¸ˆ˜‐‑‒―‖‗‥⁄⁅⁆⁇⁈⁉'), ' ', ' ', ' ', ' ', '​', '­'] },
  { name: 'Tiền tệ', symbols: chars('₫$€£¥₩₹₽¢₿₱₺₴₸฿₪₦₡₲₵₭₮₼₾﷼ƒ₠₣₤₥₧₨₯₰₳₶₷₻') },
  { name: 'Chữ có dấu', symbols: chars('ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄąĆćČčĎďĐđĒēĘęĚěĞğĪīİıŁłŃńŇňŌōŐőŒœŘřŚśŞşŠšŢţŤťŪūŮůŰűŸŹźŻżŽžƠơƯư') },
  { name: 'Hy Lạp', symbols: [...range(0x391, 0x3a1), ...range(0x3a3, 0x3a9), ...range(0x3b1, 0x3c9), ...chars('ϑϕϖϵϱς')] },
  { name: 'Toán học', symbols: chars('±∓×÷·∕≠≈≃≅≡≢≤≥≦≧≪≫∝∞√∛∜∑∏∐∫∬∭∮∯∰∆∂∇∀∃∄∈∉∋∌⊂⊃⊄⊅⊆⊇⊊⊋∪∩∅∧∨¬⊕⊖⊗⊘⊙⊥∥∦∠∡∢∟⊿∴∵∶∷∼∽≀⌊⌋⌈⌉⟨⟩‖∣∤ℵℏℓ℘ℑℜℝℕℤℚℂℙ⋮⋯⋰⋱∘∙⊢⊣⊤⊨') },
  { name: 'Chỉ số & phân số', symbols: chars('⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒↉') },
  { name: 'Đo lường & kỹ thuật', symbols: chars('℃℉°′″Ω℧µÅ㎜㎝㎞㎡㎥㎠㎢㎦㎏㎎㎖㎗㎘ℓ㏄㎾㎽㎿㎐㎑㎒㎓㎅㎆㎇㏈㏎㏑㏒㏓㏕㏖㏗⌀⏚⎓∿⚡⌁⌇⏻⏼⏽⭘⌛⌚⏰⏱⏲℮') },
  { name: 'Mũi tên', symbols: [...range(0x2190, 0x21ff), ...chars('⟵⟶⟷⟸⟹⟺⤴⤵➔➘➙➚➛➜➝➞➟➠➡➢➣➤➥➦➧➨➩➪➫➬➭➮➯➱➲➳➴➵➶➷➸➹➺➻➼➽➾⬅⬆⬇⬈⬉⬊⬋⬌⬍')] },
  { name: 'Hình học', symbols: [...range(0x25a0, 0x25ff), ...chars('⬛⬜⬟⬠⬡⬢⬣⬤⬥⬦⬧⬨⬩⬪⬫⬬⬭⬮⬯')] },
  { name: 'Sao & hoa văn', symbols: chars('★☆✦✧✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋❖❦❧☙❡❢❣❤❥☘⚘⚜') },
  { name: 'Đánh dấu & ô chọn', symbols: chars('✓✔✕✖✗✘☐☑☒⊠⊡⊞⊟✅❎●○◦◉◎‣⁃∙➢➣➤❯❱▸▹►▶◆◇❖♦♢■□▪▫') },
  { name: 'Số khoanh & La Mã', symbols: [...range(0x2460, 0x2473), ...range(0x2776, 0x277f), ...range(0x2780, 0x2789), ...range(0x24b6, 0x24e9), ...range(0x2160, 0x216f), ...range(0x2170, 0x217f), ...range(0x2474, 0x2487)] },
  { name: 'Biểu tượng chữ', symbols: chars('✂✁✃✄✆✇✈✉☎☏✍✎✏✐✑✒☀☁☂☃☄☔☕☺☻☹♀♂⚥⚠⚑⚐♻⚙⚖⚓⚛☢☣☮☯☸♨♩♪♫♬♭♮♯⚽⚾⛄⛅⛔⛪⛲⛳⛵⛺⛽☠☤☥☦☧☨☩☪☫☬☭☽☾♈♉♊♋♌♍♎♏♐♑♒♓♔♕♖♗♘♙♚♛♜♝♞♟♠♡♣♤♥♧⚀⚁⚂⚃⚄⚅') },
  { name: 'Khung kẻ & khối', symbols: [...range(0x2500, 0x257f), ...range(0x2580, 0x259f)] },
  { name: 'Mặt cười & cảm xúc', symbols: words('😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 🤖 💩 🙈 🙉 🙊 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💯 💢 💥 💫 💦 💬 💭 💤') },
  { name: 'Cử chỉ & người', symbols: words('👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 👀 👁️ 🧠 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 👮 👷 💂 🕵️ 👩‍⚕️ 👨‍⚕️ 👩‍🎓 👨‍🎓 👩‍🏫 👨‍🏫 👩‍💻 👨‍💻 👩‍💼 👨‍💼 👩‍🔧 👨‍🔧 👩‍🍳 👨‍🍳 🧑‍🚀 🙋 🙆 🙅 🤷 🤦 🏃 🚶 👪 👫') },
  { name: 'Văn phòng & đồ vật', symbols: words('📌 📍 📎 🖇️ 📏 📐 ✂️ 🗂️ 📁 📂 📅 📆 🗓️ 📇 📈 📉 📊 📋 📄 📃 📑 🧾 📰 🗞️ 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🏷️ ✏️ ✒️ 🖊️ 🖋️ 🖍️ 📝 💼 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🔧 🔩 ⚙️ 🧰 🧲 💡 🔦 🕯️ 💻 🖥️ 🖨️ ⌨️ 🖱️ 💽 💾 💿 📀 📱 📲 ☎️ 📞 📟 📠 📺 📻 📷 📸 📹 🎥 🔍 🔎 📧 📨 📩 📤 📥 📦 📫 📬 📮 ⏰ ⌛ ⏳ 🔔 🔕 📢 📣') },
  { name: 'Thiên nhiên & thời tiết', symbols: words('☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌈 ☔ 💧 🌊 🔥 ⚡ 🌍 🌎 🌏 🌙 ⭐ 🌟 ✨ ☄️ 🌱 🌿 ☘️ 🍀 🍃 🍂 🍁 🌾 🌵 🌴 🌳 🌲 🌸 🌺 🌻 🌼 🌷 🌹 🥀 💐 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐟 🐬 🐳 🐘') },
  { name: 'Ăn uống', symbols: words('🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥞 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🥛 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹') },
  { name: 'Di chuyển & địa điểm', symbols: words('🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🚁 🚀 🛸 🚢 ⛴️ 🛥️ 🚤 ⛵ ⚓ ⛽ 🚧 🚦 🚥 🗺️ 🧭 🏔️ ⛰️ 🌋 🏕️ 🏖️ 🏝️ 🏟️ 🏛️ 🏗️ 🏘️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 ⛩️ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉') },
  { name: 'Hoạt động & lễ hội', symbols: words('⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🏒 🥅 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸️ 🎿 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🧩 🎉 🎊 🎈 🎁 🎀 🎄 🎃 🎆 🎇 🧨 🧧 🏮 🎎 🎏 🎐 🎑') },
  { name: 'Dấu & ký hiệu', symbols: words('✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 🟰 ♾️ ‼️ ⁉️ ❓ ❔ ❗ ❕ ⚠️ 🚫 ⛔ 🔞 📵 🚭 ♻️ ⚜️ 🔰 ⭕ 🛑 🆗 🆕 🆓 🆙 🆒 🆘 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔀 🔁 🔂 🔄 🔃 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ ℹ️ 🔤 🔢 🏁 🚩 🏳️ 🏴 🏳️‍🌈 #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟') },
];

const INVISIBLE_SYMBOLS: Record<string, { label: string; name: string }> = {
  ' ': { label: 'NBSP', name: 'Khoảng trắng không ngắt dòng' },
  ' ': { label: 'EN', name: 'Khoảng trắng en' },
  ' ': { label: 'EM', name: 'Khoảng trắng em' },
  ' ': { label: 'THIN', name: 'Khoảng trắng hẹp' },
  '​': { label: 'ZWSP', name: 'Khoảng trắng độ rộng 0' },
  '­': { label: 'SHY', name: 'Gạch nối mềm' },
};

export const invisibleSymbol = (symbol: string) => INVISIBLE_SYMBOLS[symbol] ?? null;

export const symbolTitle = (symbol: string) => {
  const info = invisibleSymbol(symbol);
  return info ? `${info.name} (${symbolCode(symbol)})` : symbolCode(symbol);
};

export const symbolCode = (symbol: string) => Array.from(symbol).map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

export const searchSymbols = (query: string) => {
  const q = query.trim();
  if (!q) return [];
  const hex = q.replace(/^u\+?/i, '').toUpperCase();
  const isHex = /^[0-9A-F]{2,6}$/.test(hex);
  return [...new Set(SYMBOL_SETS.flatMap((set) => set.symbols))].filter((symbol) => symbol.includes(q) || (isHex && symbolCode(symbol).includes(hex)));
};
