import { Character } from '../typedef';
import { generateRandomNumber } from './randomizers';

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it.
 */
export function pronoun(characterData: Character, pronounNumber: 0 | 1 | 2 | 3 | 4 | 5): string {

	const possiblePronouns: Array<string> = [];

	for (const pronounSet of characterData.pronounSets) {

		const pronoun = pronounSet[pronounNumber];
		if (pronoun) { possiblePronouns.push(pronoun); }
	}

	const returnString = possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
	if (!returnString) { throw new TypeError('returnString is not a string'); }
	return returnString;
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it in uppercase.
 */
export function upperCasePronoun(characterData: Character, pronounNumber: 0 | 1 | 2 | 3 | 4 | 5): string {

	const pronounString = pronoun(characterData, pronounNumber);

	return pronounString.charAt(0).toUpperCase() + pronounString.slice(1);
}

/**
 * Checks whether a pronoun comes from a set that is plural, and returns a boolean.
 */
export function isPlural(characterData: Character, pronounString: string): boolean {

	for (const pronounSet of characterData.pronounSets) {

		if (pronounSet.includes(pronounString)) {

			return pronounSet[5] === 'singular' ? false : true;
		}
	}

	throw new Error(`${pronounString} is not in any pronoun set`);
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 */
export function pronounAndPlural(characterData: Character, pronounNumber: 0 | 1 | 2 | 3 | 4 | 5, string1: string, string2?: string): string {

	const pronounString = pronoun(characterData, pronounNumber);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(characterData, pronounString) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(characterData, pronounString) === false ? string1 : string2}`;
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns in uppercase with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 */
export function upperCasePronounAndPlural(charaterData: Character, pronounNumber: 0 | 1 | 2 | 3 | 4 | 5, string1: string, string2?: string): string {

	const normalPronoun = pronoun(charaterData, pronounNumber);
	const pronounString = normalPronoun.charAt(0).toUpperCase() + normalPronoun.slice(1);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(charaterData, normalPronoun) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(charaterData, normalPronoun) === false ? string1 : string2}`;
}