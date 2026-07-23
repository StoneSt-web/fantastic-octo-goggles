// edge-tts 封装 —— 基于 edge-tts-universal(社区维护,已处理 Sec-MS-GEC)
// 用于主进程 IPC: pet:tts-synthesize(text, voice, opts) → mp3 Buffer
const { Communicate } = require('edge-tts-universal');

/**
 * 合成语音 → 返回 mp3 Buffer
 * @param {string} text - 要朗读的文字
 * @param {Object} opts
 * @param {string} [opts.voice='zh-CN-XiaoxiaoNeural'] - 微软神经 voice 短名
 * @param {string} [opts.rate='+0%'] - 语速调整
 * @param {string} [opts.pitch='+0Hz'] - 音调调整
 * @param {string} [opts.volume='+0%'] - 音量调整
 * @returns {Promise<Buffer>} mp3 buffer
 */
async function synthesize(text, opts = {}) {
  if (!text || !text.trim()) {
    throw new Error('edge-tts: empty text');
  }
  const voice = opts.voice || 'zh-CN-XiaoxiaoNeural';
  const rate = opts.rate || '+0%';
  const pitch = opts.pitch || '+0Hz';
  const volume = opts.volume || '+0%';

  const c = new Communicate(text, { voice, rate, pitch, volume });
  const chunks = [];
  for await (const chunk of c.stream()) {
    if (chunk.type === 'audio') chunks.push(chunk.data);
  }
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) {
    throw new Error('edge-tts: empty audio returned');
  }
  return buf;
}

/**
 * v1.11.5: 推荐 voice 列表 —— 微软神经语音(真人质量)
 * 给 settings.js 显示 dropdown 用
 */
const RECOMMENDED_VOICES = [
  // 中文男声
  { id: 'zh-CN-YunyangNeural', label: '云扬 (男·新闻)', gender: 'male', desc: '成年男声 · 新闻播报风格' },
  { id: 'zh-CN-YunxiNeural',   label: '云希 (男·阳光)', gender: 'male', desc: '青年男声 · 活泼' },
  { id: 'zh-CN-YunjianNeural', label: '云健 (男·运动)', gender: 'male', desc: '青年男声 · 运动风格' },
  { id: 'zh-CN-YunfanNeural',  label: '云帆 (男·助理)', gender: 'male', desc: '青年男声 · 智能助理' },
  // 中文女声
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女·温柔)', gender: 'female', desc: '成年女声 · 温柔甜美' },
  { id: 'zh-CN-YunxiaNeural',   label: '云夏 (女·活力)', gender: 'female', desc: '青年女声 · 活泼' },
  { id: 'zh-CN-XiaoyiNeural',   label: '晓伊 (女·情感)', gender: 'female', desc: '青年女声 · 情感丰富' },
  { id: 'zh-CN-XiaomengNeural', label: '晓梦 (女·可爱)', gender: 'female', desc: '儿童女声 · 可爱' },
  // 中文童声
  { id: 'zh-CN-YunzeNeural',    label: '云泽 (童·男)',   gender: 'male', desc: '儿童男声' },
];

/**
 * v1.11.5: 根据性别 + 年龄自动匹配最合适的 voice
 * @param {string} gender - 'male' / 'female' / 'other'
 * @param {string|number} birthday - YYYY-MM-DD 或空
 * @returns {string} voice 短名
 */
function pickVoiceByProfile(gender, birthday) {
  const age = calcAge(birthday);

  if (gender === 'male') {
    if (age == null) return 'zh-CN-YunyangNeural';    // 没年龄 → 默认成年男声(云扬)
    if (age < 14) return 'zh-CN-YunzeNeural';         // 童声
    if (age < 30) return 'zh-CN-YunxiNeural';         // 青年男声(活泼)
    if (age < 55) return 'zh-CN-YunjianNeural';       // 中年男声(稳重 + 一点点冲劲)
    return 'zh-CN-YunyangNeural';                     // 老年男声(新闻腔,稳重)
  }

  if (gender === 'female') {
    if (age == null) return 'zh-CN-XiaoxiaoNeural';   // 默认成年女声(晓晓)
    if (age < 14) return 'zh-CN-XiaomengNeural';      // 童声
    if (age < 30) return 'zh-CN-YunxiaNeural';        // 青年女声(活力)
    if (age < 55) return 'zh-CN-XiaoyiNeural';        // 中年女声(情感)
    return 'zh-CN-XiaoxiaoNeural';                    // 老年女声(晓晓)
  }

  // other / 未设定
  return age != null && age < 14 ? 'zh-CN-YunzeNeural' : 'zh-CN-YunyangNeural';
}

/**
 * 算年龄(周岁)
 */
function calcAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

module.exports = { synthesize, RECOMMENDED_VOICES, pickVoiceByProfile };