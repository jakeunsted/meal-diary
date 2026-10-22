import { createHash } from 'crypto';
import { Op } from 'sequelize';
import { FEATURE_FLAGS } from '@meal-diary/shared';
import type { LegacyMealKey } from '@meal-diary/shared';
import {
  AlexaAccessToken,
  AlexaLink,
  DailyMeal,
  FamilyGroup,
  MealDiary,
  Recipe,
  User,
} from '../db/models/associations.ts';
import { isFeatureEnabled } from '../utils/posthog.ts';
import * as EntitlementsService from './entitlements.service.ts';
import { buildDaySlotsForWeek, getActiveMealSlots } from './mealSlots.service.ts';
import type { DayMealSlotDto, MealSlotDto } from './mealSlots.service.ts';
import {
  ALEXA_SPEECH,
  diaryDateForAlexa,
  selectLegacySlot,
  speakFood,
  speakFullDay,
  speakMissingLegacyMeal,
  speakNamedMeal,
  type AlexaDiaryDay,
  type SpokenSlot,
} from './alexaSpeech.service.ts';

const ALEXA_SKILL_DISTINCT_ID = 'alexa-skill';
const AMAZON_API_HOST_SUFFIX = '.amazonalexa.com';

export interface AlexaSlotValue {
  name?: string;
  value?: string;
  resolutions?: {
    resolutionsPerAuthority?: Array<{
      status?: { code?: string };
      values?: Array<{ value?: { name?: string } }>;
    }>;
  };
}

export interface AlexaRequestEnvelope {
  session?: {
    application?: { applicationId?: string };
    user?: { userId?: string; accessToken?: string };
  };
  context?: {
    System?: {
      application?: { applicationId?: string };
      user?: { userId?: string; accessToken?: string };
      apiAccessToken?: string;
      apiEndpoint?: string;
      device?: { deviceId?: string };
    };
  };
  request?: {
    type?: string;
    timestamp?: string;
    intent?: {
      name?: string;
      slots?: Record<string, AlexaSlotValue | undefined>;
    };
  };
}

export interface AlexaSkillResponse {
  version: '1.0';
  response: {
    outputSpeech?: {
      type: 'PlainText';
      text: string;
    };
    card?: { type: 'LinkAccount' };
    shouldEndSession?: boolean;
  };
}

export interface AlexaFulfillment {
  httpStatus: number;
  body: AlexaSkillResponse | null;
}

interface LinkedAlexaUser {
  user: User;
  link: AlexaLink;
}

const speak = (text: string): AlexaFulfillment => ({
  httpStatus: 200,
  body: {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      shouldEndSession: true,
    },
  },
});

const linkAccountResponse = (): AlexaFulfillment => ({
  httpStatus: 200,
  body: {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: ALEXA_SPEECH.linkAccount },
      card: { type: 'LinkAccount' },
      shouldEndSession: true,
    },
  },
});

const unavailableResponse = (): AlexaFulfillment => speak(ALEXA_SPEECH.unavailable);

const readAccessToken = (body: AlexaRequestEnvelope): string | null => {
  const fromContext = body.context?.System?.user?.accessToken;
  if (typeof fromContext === 'string' && fromContext.length > 0) {
    return fromContext;
  }
  const fromSession = body.session?.user?.accessToken;
  if (typeof fromSession === 'string' && fromSession.length > 0) {
    return fromSession;
  }
  return null;
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const resolveAccessToken = async (accessToken: string): Promise<LinkedAlexaUser | null> => {
  const row = await AlexaAccessToken.findOne({
    where: { token_hash: sha256Hex(accessToken) },
  });
  if (!row || new Date(row.dataValues.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const link = await AlexaLink.findByPk(row.dataValues.alexa_link_id);
  if (!link || link.dataValues.revoked_at) {
    return null;
  }

  const user = await User.findByPk(link.dataValues.user_id);
  if (!user) {
    return null;
  }

  return { user, link };
};

const canonicalSlotValue = (slot: AlexaSlotValue | undefined): string | undefined => {
  const authorities = slot?.resolutions?.resolutionsPerAuthority ?? [];
  for (const authority of authorities) {
    if (authority.status?.code !== 'ER_SUCCESS_MATCH') {
      continue;
    }
    const resolved = authority.values?.[0]?.value?.name;
    if (resolved) {
      return resolved;
    }
  }
  return slot?.value;
};

const normalizeDay = (slot: AlexaSlotValue | undefined): AlexaDiaryDay | 'missing' | 'invalid' => {
  const value = canonicalSlotValue(slot);
  if (!value) {
    return 'missing';
  }
  if (value === 'today' || value === 'tonight') {
    return 'today';
  }
  if (value === 'tomorrow') {
    return 'tomorrow';
  }
  return 'invalid';
};

const normalizeMeal = (slot: AlexaSlotValue | undefined): LegacyMealKey | null => {
  const value = canonicalSlotValue(slot);
  if (value === 'breakfast' || value === 'lunch' || value === 'dinner') {
    return value;
  }
  if (value === 'supper') {
    return 'dinner';
  }
  return null;
};

const isAmazonApiEndpoint = (apiEndpoint: string): boolean => {
  let url: URL;
  try {
    url = new URL(apiEndpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    (url.hostname === 'api.amazonalexa.com' || url.hostname.endsWith(AMAZON_API_HOST_SUFFIX))
  );
};

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
};

const readDeviceTimeZone = async (body: AlexaRequestEnvelope): Promise<string | null> => {
  const apiEndpoint = body.context?.System?.apiEndpoint;
  const deviceId = body.context?.System?.device?.deviceId;
  const apiAccessToken = body.context?.System?.apiAccessToken;
  const timestamp = body.request?.timestamp;
  if (!apiEndpoint || !deviceId || !apiAccessToken || !timestamp) {
    return null;
  }
  if (Number.isNaN(new Date(timestamp).getTime()) || !isAmazonApiEndpoint(apiEndpoint)) {
    return null;
  }

  try {
    const endpoint = new URL(apiEndpoint);
    const url = `${endpoint.origin}/v2/devices/${encodeURIComponent(deviceId)}/settings/System.timeZone`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiAccessToken}` },
    });
    if (!response.ok) {
      return null;
    }
    const timeZone = await response.json();
    if (typeof timeZone !== 'string' || !isValidTimeZone(timeZone)) {
      return null;
    }
    return timeZone;
  } catch {
    return null;
  }
};

const emptySlot = (slot: MealSlotDto): DayMealSlotDto => ({
  id: 0,
  meal_slot_id: slot.id,
  name: slot.name,
  position: slot.position,
  dish: null,
  recipe_id: null,
  legacy_key: slot.legacy_key,
});

const utcMidnight = (civilDate: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) {
    throw new Error('Invalid civil date');
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const localNoon = (civilDate: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) {
    throw new Error('Invalid civil date');
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
};

/**
 * Read one diary day without creating a MealDiary or DailyMeal.
 * Do not call getWeeklyMeals (it find-or-creates the week) or assertCanNavigateWeek.
 * The alexa entitlement has already passed, and premium maxWeeksAhead is unlimited,
 * so Sunday tomorrow (next week's Monday) is allowed. Do not reuse the free
 * one-week-ahead rule here.
 */
const loadDaySlots = async (
  familyGroupId: number,
  weekStartDate: string,
  dayOfWeek: number,
  todayCivilDate: string
): Promise<DayMealSlotDto[]> => {
  const diary = await MealDiary.findOne({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate,
    },
  });

  if (!diary) {
    const active = await getActiveMealSlots(familyGroupId);
    return active.map(emptySlot);
  }

  const dayRow = await DailyMeal.findOne({
    where: {
      meal_diary_id: diary.dataValues.id,
      day_of_week: dayOfWeek,
    },
  });

  if (!dayRow) {
    const active = await getActiveMealSlots(familyGroupId);
    return active.map(emptySlot);
  }

  const slotsByDay = await buildDaySlotsForWeek(
    familyGroupId,
    localNoon(weekStartDate),
    [{ id: dayRow.dataValues.id, day_of_week: dayOfWeek }],
    utcMidnight(todayCivilDate)
  );
  return slotsByDay.get(dayOfWeek) ?? [];
};

const recipeNamesForSlots = async (
  familyGroupId: number,
  slots: DayMealSlotDto[]
): Promise<Map<number, string>> => {
  const ids = [
    ...new Set(
      slots
        .map((slot) => slot.recipe_id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ];
  if (ids.length === 0) {
    return new Map();
  }

  const recipes = await Recipe.findAll({
    where: {
      id: { [Op.in]: ids },
      family_group_id: familyGroupId,
    },
    attributes: ['id', 'name'],
  });

  return new Map(recipes.map((recipe) => [recipe.dataValues.id, recipe.dataValues.name]));
};

const toSpokenSlots = (slots: DayMealSlotDto[], recipeNames: Map<number, string>): SpokenSlot[] =>
  slots.map((slot) => ({
    name: slot.name,
    position: slot.position,
    legacyKey: slot.legacy_key,
    dish: slot.dish,
    recipeName: slot.recipe_id ? recipeNames.get(slot.recipe_id) ?? null : null,
  }));

const rememberAmazonUser = async (body: AlexaRequestEnvelope, link: AlexaLink): Promise<void> => {
  const amazonUserId = body.session?.user?.userId;
  if (!amazonUserId) {
    return;
  }
  await link.update({ amazon_user_id: amazonUserId });
};

const readMeals = async (
  body: AlexaRequestEnvelope,
  linked: LinkedAlexaUser,
  kind: 'diary' | 'meal'
): Promise<AlexaFulfillment> => {
  const slots = body.request?.intent?.slots;
  const daySlot = normalizeDay(slots?.day);
  if (daySlot === 'invalid') {
    return speak(ALEXA_SPEECH.fallback);
  }
  const day: AlexaDiaryDay = daySlot === 'tomorrow' ? 'tomorrow' : 'today';

  let meal: LegacyMealKey | null = null;
  if (kind === 'meal') {
    meal = normalizeMeal(slots?.meal);
    if (!meal) {
      return speak(ALEXA_SPEECH.fallback);
    }
  }

  const familyGroupId = linked.user.dataValues.family_group_id;
  if (familyGroupId === null || familyGroupId === undefined) {
    return speak(ALEXA_SPEECH.noFamily);
  }

  try {
    await EntitlementsService.assertFeature(familyGroupId, linked.user.dataValues.id, 'alexa');
  } catch (error) {
    if (error instanceof EntitlementsService.EntitlementRequiredError) {
      return speak(ALEXA_SPEECH.familyPlus);
    }
    throw error;
  }

  const timeZone = await readDeviceTimeZone(body);
  const timestamp = body.request?.timestamp;
  if (!timeZone || !timestamp) {
    return speak(ALEXA_SPEECH.timezone);
  }

  const target = diaryDateForAlexa(timestamp, timeZone, day);
  const today = diaryDateForAlexa(timestamp, timeZone, 'today');
  const daySlots = await loadDaySlots(
    familyGroupId,
    target.weekStartDate,
    target.dayOfWeek,
    today.civilDate
  );
  const recipeNames = await recipeNamesForSlots(familyGroupId, daySlots);
  const spoken = toSpokenSlots(daySlots, recipeNames);

  let text: string;
  if (kind === 'meal' && meal) {
    const slot = selectLegacySlot(spoken, meal);
    text = slot
      ? speakNamedMeal(slot.name, speakFood(slot.dish, slot.recipeName), day)
      : speakMissingLegacyMeal(meal);
  } else {
    const family = await FamilyGroup.findByPk(familyGroupId);
    text = speakFullDay(family?.dataValues.name, spoken, day);
  }

  await rememberAmazonUser(body, linked.link);
  return speak(text);
};

const fulfillLinkedRequest = async (
  body: AlexaRequestEnvelope,
  linked: LinkedAlexaUser
): Promise<AlexaFulfillment> => {
  const requestType = body.request?.type;
  const intentName = body.request?.intent?.name;

  if (requestType === 'SessionEndedRequest') {
    return { httpStatus: 200, body: { version: '1.0', response: {} } };
  }

  if (
    requestType === 'LaunchRequest' ||
    (requestType === 'IntentRequest' && intentName === 'AMAZON.HelpIntent')
  ) {
    return speak(ALEXA_SPEECH.launch);
  }

  if (
    requestType === 'IntentRequest' &&
    (intentName === 'AMAZON.CancelIntent' || intentName === 'AMAZON.StopIntent')
  ) {
    return speak(ALEXA_SPEECH.okay);
  }

  if (requestType === 'IntentRequest' && intentName === 'GetDiaryIntent') {
    return readMeals(body, linked, 'diary');
  }

  if (requestType === 'IntentRequest' && intentName === 'GetMealIntent') {
    return readMeals(body, linked, 'meal');
  }

  return speak(ALEXA_SPEECH.fallback);
};

export const fulfillAlexaSkill = async (payload: unknown): Promise<AlexaFulfillment> => {
  const body = (payload && typeof payload === 'object' ? payload : {}) as AlexaRequestEnvelope;
  const accessToken = readAccessToken(body);
  const linked = accessToken ? await resolveAccessToken(accessToken) : null;

  if (!linked) {
    const enabled = await isFeatureEnabled(ALEXA_SKILL_DISTINCT_ID, FEATURE_FLAGS.alexaConnection);
    if (!enabled) {
      return { httpStatus: 404, body: null };
    }
    return linkAccountResponse();
  }

  const enabled = await isFeatureEnabled(
    String(linked.user.dataValues.id),
    FEATURE_FLAGS.alexaConnection
  );
  if (!enabled) {
    if (body.request?.type === 'SessionEndedRequest') {
      return { httpStatus: 200, body: { version: '1.0', response: {} } };
    }
    return unavailableResponse();
  }

  return fulfillLinkedRequest(body, linked);
};
