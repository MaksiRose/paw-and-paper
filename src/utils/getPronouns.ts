import { Character } from '../typedef';
import { generateRandomNumber } from './randomizers';

export function pronoun(characterData: Character, pronounNumber: 0 | 1 | 2 | 3 | 4 | 5): string {

	const possiblePronouns = [];

	for (const pronounSet of characterData.pronounSets) {

		possiblePronouns.push(pronounSet[pronounNumber]);
	}

	return possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
}