import { Message } from 'discord.js';

export function getMapData<T>(map: Record<string, T>, key: string): T {
	const data = map[key];
	if (!data) throw new TypeError(`${data} is undefined`);
	return data;
}

export function getUserIds(message: Message): Array<string> {

	const array1 = message.mentions.users.map(u => u.id);
	const array2 = (message.content.match(/<@!?(\d{17,19})>/g) || [])?.map(mention => mention.replace('<@', '').replace('>', '').replace('!', ''));

	return [...new Set([...array1, ...array2])];
}