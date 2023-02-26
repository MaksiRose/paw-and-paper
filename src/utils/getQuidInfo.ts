import GroupToServer from '../models/groupToServer';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import UserToServer from '../models/userToServer';
import { getArrayElement } from './helperFunctions';
import { getRandomNumber } from './randomizers';

export async function getDisplayname(
	quid: Quid,
	options: { serverId?: string; groupToServer?: GroupToServer; userToServer?: UserToServer; quidToServer?: QuidToServer },
): Promise<string> {

	const group = quid.mainGroup;
	const groupToServer = options.groupToServer ?? ((group !== null && options.serverId !== undefined) ? await GroupToServer.findOne({
		where: {
			groupId: group.id,
			serverId: options.serverId,
		},
	}) : null);
	const groupTag = groupToServer?.tag || group?.tag || '';

	const userToServer = options.userToServer ?? (options.serverId !== undefined ? await UserToServer.findOne({
		where: {
			userId: quid.userId,
			serverId: options.serverId,
		},
	}) : null);
	const userTag = userToServer?.tag || quid.user.tag || '';

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

	return quid.displayedSpecies || quid.species;
}

function getRandomPronounSet(
	pronouns: string[][],
	noPronouns: boolean,
	name: string,
): string[] {

	if (noPronouns === true) { pronouns.push(['none']); }
	let pronounSet = getArrayElement(pronouns, getRandomNumber(pronouns.length));
	if (pronounSet.length === 1 && pronounSet[0] === 'none') { pronounSet = [name, name, `${name}s`, `${name}s`, `${name}self`, 'singular']; }

	return pronounSet;
}

export function pronoun(
	quid: Quid,
	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
): string {

	const pronounSet = getRandomPronounSet(quid.pronouns_en, quid.noPronouns_en, quid.name);
	return getArrayElement(pronounSet, pronounNumber);
}

export function pronounAndPlural(
	quid: Quid,
	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
	string1: string,
	string2?: string,
): string {

	const pronounSet = getRandomPronounSet(quid.pronouns_en, quid.noPronouns_en, quid.name);

	const pronoun = getArrayElement(pronounSet, pronounNumber);
	const isPlural = pronounSet[5] === 'plural';

	if (string2 === undefined) { return `${pronoun} ${string1}${isPlural === false ? 's' : ''}`; }
	return `${pronoun} ${isPlural === false ? string1 : string2}`;
}