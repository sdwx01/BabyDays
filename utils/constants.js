// App-wide constants: categories, picker options, color tokens

const CATEGORIES = [
  { key: 'feeding',     label: '喂奶',   emoji: '🍼', color: '#FFB5C8', bgColor: '#FFF0F5' },
  { key: 'diaper',      label: '尿布',   emoji: '👶', color: '#FFE4B5', bgColor: '#FFFBF0' },
  { key: 'sleep',       label: '睡眠',   emoji: '😴', color: '#B5F0FF', bgColor: '#F0FBFF' },
  { key: 'medication',  label: '用药',   emoji: '💊', color: '#B5D5FF', bgColor: '#F0F5FF' },
  { key: 'vaccination', label: '疫苗',   emoji: '💉', color: '#C8B5FF', bgColor: '#F5F0FF' },
  { key: 'outing',      label: '外出',   emoji: '🌳', color: '#B5FFD5', bgColor: '#F0FFF5' },
  { key: 'bath',        label: '洗澡',   emoji: '🛁', color: '#B5E8FF', bgColor: '#F0F8FF' },
  { key: 'food',        label: '辅食',   emoji: '🥕', color: '#FFD5B5', bgColor: '#FFF8F0' },
  { key: 'milestone',   label: '里程碑', emoji: '⭐', color: '#FFF4B5', bgColor: '#FFFFF0' }
];

const CATEGORY_MAP = CATEGORIES.reduce((map, cat) => {
  map[cat.key] = cat;
  return map;
}, {});

// Feeding source options
const FEEDING_SOURCES = [
  { value: 'bottle', label: '奶瓶' },
  { value: 'left',   label: '左侧母乳' },
  { value: 'right',  label: '右侧母乳' }
];

// Diaper type options
const DIAPER_TYPES = [
  { value: 'wet',   label: '湿尿布', emoji: '💧' },
  { value: 'dirty', label: '大便',   emoji: '💩' },
  { value: 'both',  label: '两者',   emoji: '💧💩' }
];

const DIAPER_COLORS = ['黄色', '绿色', '褐色', '黑色', '血丝', '其他'];

const DIAPER_CONSISTENCY = ['正常糊状', '稀', '成形', '水样'];

// Sleep location options
const SLEEP_LOCATIONS = ['小床', '怀里', '推车', '大床'];

// Weather options
const WEATHER_OPTIONS = ['晴天', '多云', '阴天', '雨天', '雪天'];

// Food reaction options
const FOOD_REACTIONS = ['很喜欢', '一般', '不喜欢', '疑似过敏'];

// Milestone types
const MILESTONE_TYPES = ['运动', '社交', '认知', '语言', '情感', '其他'];

// Common milestone suggestions
const MILESTONE_SUGGESTIONS = [
  '第一次微笑',
  '第一次翻身',
  '第一次抬头',
  '第一次发声',
  '第一次大笑',
  '第一次认出妈妈',
  '第一次抓握玩具',
  '第一次坐起',
  '第一次爬行',
  '第一次站立',
  '第一次走路',
  '第一次说话'
];

// Common baby medications — seed list used when the user-added
// medication list is empty. Each entry may include a suggested default
// dose; the form just prefills that field and lets the user adjust.
const COMMON_MEDICATIONS = [
  { name: '维生素D滴剂',      dose: '400 IU' },
  { name: '维生素AD',          dose: '1 粒' },
  { name: '布洛芬混悬液',      dose: '' },
  { name: '对乙酰氨基酚',      dose: '' },
  { name: '益生菌',            dose: '1 袋' },
  { name: '开塞露',            dose: '' },
  { name: '蒙脱石散',          dose: '' },
  { name: '口服补液盐',        dose: '' },
  { name: '小儿氨酚黄那敏',    dose: '' }
];

module.exports = {
  CATEGORIES,
  CATEGORY_MAP,
  FEEDING_SOURCES,
  DIAPER_TYPES,
  DIAPER_COLORS,
  DIAPER_CONSISTENCY,
  SLEEP_LOCATIONS,
  WEATHER_OPTIONS,
  FOOD_REACTIONS,
  MILESTONE_TYPES,
  MILESTONE_SUGGESTIONS,
  COMMON_MEDICATIONS
};
