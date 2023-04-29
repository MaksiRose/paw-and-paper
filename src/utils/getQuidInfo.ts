import Group from '../models/group';
import GroupToServer from '../models/groupToServer';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import User from '../models/user';
import UserToServer from '../models/userToServer';
import { deepCopy, getArrayElement } from './helperFunctions';
import { getRandomNumber } from './randomizers';

export async function getDisplayname(
	quid: Quid,
	options: { serverId?: string; groupToServer?: GroupToServer; userToServer?: UserToServer; quidToServer?: QuidToServer, user?: User; },
): Promise<string> {

	const userToServer = options.userToServer ?? (options.serverId !== undefined ? await UserToServer.findOne({
		where: {
			userId: quid.userId,
			serverId: options.serverId,
		},
	}) : null);
	if (options.user === undefined) { options.user = await User.findByPk(quid.userId) ?? undefined; }
	const userTag = userToServer?.tag || options.user?.tag || '';

	const group = userTag.length > 0 ? null : quid.mainGroupId === null ? null : await Group.findByPk(quid.mainGroupId);
	const groupToServer = userTag.length > 0 ? null : options.groupToServer ?? ((group !== null && options.serverId !== undefined) ? await GroupToServer.findOne({
		where: {
			groupId: group.id,
			serverId: options.serverId,
		},
	}) : null);
	const groupTag = userTag.length > 0 ? '' : (groupToServer?.tag || group?.tag || '');

	const tag = userTag || groupTag;

	const quidToServer = options.quidToServer ?? (options.serverId !== undefined ? await QuidToServer.findOne({
		where: {
			quidId: quid.id,
			serverId: options.serverId,
		},
	}) : null);
	return (quidToServer?.nickname || quid.nickname || quid.name) + (tag ? ` ${tag}` : '');
}

export function getDisplayspecies(
	quid: Quid,
): string {

	return quid.displayedSpecies || '';
}

function getRandomPronounSet(
	quid: Quid,
): string[] {

	const pronouns = deepCopy(quid.pronouns_en);
	if (quid.noPronouns_en === true) { pronouns.push([quid.name, quid.name, `${quid.name}s`, `${quid.name}s`, `${quid.name}self`, 'singular']); }
	const pronounSet = getArrayElement(pronouns, getRandomNumber(pronouns.length));

	return pronounSet;
}

export function pronoun(
	quid: Quid,
	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
): string {

	const pronounSet = getRandomPronounSet(quid);
	return getArrayElement(pronounSet, pronounNumber);
}

export function pronounAndPlural(
	quid: Quid,
	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
	string1: string,
	string2?: string,
): string {

	const pronounSet = getRandomPronounSet(quid);

	const pronoun = getArrayElement(pronounSet, pronounNumber);
	const isPlural = pronounSet[5] === 'plural';

	if (string2 === undefined) { return `${pronoun} ${string1}${isPlural === false ? 's' : ''}`; }
	return `${pronoun} ${isPlural === false ? string1 : string2}`;
}