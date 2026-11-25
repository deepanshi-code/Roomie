/**
 * The lifestyle questionnaire. Every question is ORDINAL: options are ordered
 * from one extreme to the other, so "distance" between two answers is meaningful.
 * That ordering is what the matching engine relies on — keep it when editing.
 *
 * Where possible, questions describe a concrete behaviour/scenario rather than
 * asking people to rate themselves ("I am clean: 1–5"), because self-ratings
 * are notoriously optimistic.
 */

export const CATEGORIES = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'cleanliness', label: 'Cleanliness' },
  { id: 'social', label: 'Social life' },
  { id: 'habits', label: 'Habits & food' },
  { id: 'home', label: 'Home & money' },
];

export const QUESTIONS = [
  // Schedule
  {
    id: 'sleep', category: 'schedule', short: 'Bedtime',
    text: 'When do you usually go to sleep?',
    options: ['Before 10 pm', '10 pm – midnight', 'Midnight – 2 am', 'After 2 am'],
  },
  {
    id: 'wake', category: 'schedule', short: 'Wake-up time',
    text: 'When do you usually wake up?',
    options: ['Before 6 am', '6 – 8 am', '8 – 10 am', 'After 10 am'],
  },
  {
    id: 'homeTime', category: 'schedule', short: 'Time at home',
    text: 'How much of the day are you at home?',
    options: ['Rarely — out all day', 'Some days', 'Most days (WFH / online classes)'],
  },

  // Cleanliness
  {
    id: 'dishes', category: 'cleanliness', short: 'Dirty dishes',
    text: 'Your dishes have been in the sink since lunch. You…',
    options: ['Already washed them', 'Wash them by night', 'Get to them in a day or two', 'Wait until someone says something'],
  },
  {
    id: 'tidiness', category: 'cleanliness', short: 'Shared spaces',
    text: 'How do shared spaces (living room, kitchen) usually look when you live there?',
    options: ['Spotless', 'Mostly tidy', 'Lived-in', 'Chaotic, but I know where things are'],
  },
  {
    id: 'chores', category: 'cleanliness', short: 'Chores',
    text: 'How should chores be divided?',
    options: ['Fixed rota, written down', 'Take turns loosely', 'Whoever notices does it'],
  },

  // Social
  {
    id: 'guests', category: 'social', short: 'Guests',
    text: 'How often do you have friends over?',
    options: ['Rarely', 'A few times a month', 'Every week', 'Several times a week'],
  },
  {
    id: 'overnight', category: 'social', short: 'Overnight guests',
    text: 'Overnight guests (friends or partner)?',
    options: ['Never', 'Occasionally, with notice', 'Often'],
  },
  {
    id: 'noise', category: 'social', short: 'Noise at home',
    text: 'What noise level is normal for you at home?',
    options: ['Library quiet', 'Quiet, with headphones / soft calls', 'Music, calls and TV are normal', 'Loud is fine'],
  },
  {
    id: 'social', category: 'social', short: 'Roommate relationship',
    text: 'What kind of relationship do you want with your roommate?',
    options: ['Polite, we keep to ourselves', 'Friendly chats now and then', 'Hang out often', 'Basically best friends'],
  },

  // Habits & food
  {
    id: 'smoking', category: 'habits', short: 'Smoking',
    text: 'Smoking?',
    options: ["I don't smoke and want no smoke around", "I don't smoke, fine if it's outside", 'I smoke, but only outside', 'I smoke indoors'],
  },
  {
    id: 'drinking', category: 'habits', short: 'Alcohol',
    text: 'Alcohol at home?',
    options: ['Prefer an alcohol-free home', "Don't drink, don't mind others", 'Occasionally', 'Regularly'],
  },
  {
    id: 'diet', category: 'habits', short: 'Food in the kitchen',
    text: 'Food in the shared kitchen?',
    options: ['Strictly vegetarian kitchen', "I'm veg, fine if others cook non-veg", 'I eat non-veg sometimes', 'I cook non-veg regularly'],
  },
  {
    id: 'cooking', category: 'habits', short: 'Cooking',
    text: 'How often do you cook?',
    options: ['Never — order in / mess', 'A few times a week', 'Daily'],
  },

  // Home & money
  {
    id: 'pets', category: 'home', short: 'Pets',
    text: 'Pets?',
    options: ['No pets, please', 'Fine with pets', 'I have or want a pet'],
  },
  {
    id: 'bills', category: 'home', short: 'Splitting expenses',
    text: 'Splitting shared expenses (groceries, Wi-Fi, help)?',
    options: ['Track every rupee in an app', 'Split roughly, settle monthly', "Easygoing — it'll even out"],
  },
];

export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export const IMPORTANCE_LABELS = ["Doesn't matter", 'A little', 'Somewhat', 'Very important'];

export const GENDERS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'non_binary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

export const HOUSING = [
  { id: 'have_room', label: 'I have a place, need a roommate' },
  { id: 'need_room', label: 'Looking for a place together' },
  { id: 'either', label: 'Either works' },
];

export const GENDER_PREFS = [
  { id: 'any', label: 'Any gender' },
  { id: 'same', label: 'Same gender only' },
];

export const SUGGESTED_INTERESTS = [
  'Fitness', 'Yoga', 'Running', 'Cricket', 'Football', 'Gaming', 'Movies', 'Anime',
  'Music', 'Guitar', 'Reading', 'Writing', 'Coding', 'Startups', 'Photography', 'Art',
  'Cooking', 'Baking', 'Travel', 'Trekking', 'Cycling', 'Dancing', 'Board games',
  'Podcasts', 'Meditation', 'Volunteering', 'Fashion', 'Tech', 'Pets', 'Spirituality',
];
